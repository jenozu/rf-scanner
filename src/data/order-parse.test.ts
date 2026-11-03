import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parsePurchaseOrderRows, parseSalesOrderRows, parsePOFileWithReport,
  parseSalesOrderFileWithReport,
} from './order-parse';

const fixtures = join(__dirname, 'fixtures');
const csvFile = (name: string) =>
  new File([readFileSync(join(fixtures, name), 'utf8')], name, { type: 'text/csv' });
const xlsxFile = () =>
  new File([readFileSync(join(fixtures, 'sap-sample.xlsx'))], 'sap-sample.xlsx');

const po = (over: Record<string, unknown> = {}) => ({
  DocNum: '900', CardName: 'Vendor A', ReqDate: '2026-11-15', LineNum: '1',
  ItemCode: 'A', Quantity: '10', OpenQty: '10', ...over,
});
const so = (over: Record<string, unknown> = {}) => ({
  soNumber: '800', customer: 'Cust A', CardCode: 'C-1', LineNumber: '1',
  ItemCode: 'A', OrderedQty: '10', OpenQty: '10', ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('11.3 deterministic identity', () => {
  it('PO and SO ids come from the document number', async () => {
    const pos = await parsePOFileWithReport(csvFile('po-sample.csv'));
    expect(pos.orders.map((o) => o.id)).toEqual(['po-5000001', 'po-5000002']);
    const sos = await parseSalesOrderFileWithReport(csvFile('so-sample.csv'));
    expect(sos.orders.map((o) => o.id)).toEqual(['so-7000001', 'so-7000002']);
  });

  it('the same file parsed twice gives identical results', async () => {
    const first = await parsePOFileWithReport(csvFile('po-sample.csv'));
    const second = await parsePOFileWithReport(csvFile('po-sample.csv'));
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('does not read the clock for PO ids', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Date.now used'); });
    expect(() => parsePurchaseOrderRows([po()])).not.toThrow();
  });

  it('two lines with the same ItemCode stay separate lines of one PO', async () => {
    const { orders } = await parsePOFileWithReport(csvFile('po-sample.csv'));
    const lines = orders[0].items;
    expect(lines.map((l) => l.LineNumber)).toEqual([1, 2, 3]);
    expect(lines.filter((l) => l.ItemCode === 'ITEM-100')).toHaveLength(2);
  });

  it('SO lines keep their line numbers when an ItemCode repeats', async () => {
    const { orders } = await parseSalesOrderFileWithReport(csvFile('so-sample.csv'));
    expect(orders[0].items.map((l) => l.LineNumber)).toEqual([1, 2]);
  });
});

describe('11.4 validation report', () => {
  it('lists each skipped row with its reason', async () => {
    const { report } = await parsePOFileWithReport(csvFile('po-sample.csv'));
    expect(report.skipped.map((s) => s.row)).toEqual([5, 6, 7]);
    expect(report.skipped[0]).toMatchObject({ document: '5000003' });
    expect(report.skipped[0].reason).toContain('"abc"');
    expect(report.skipped[1].reason).toBe('missing ItemCode');
    expect(report.skipped[2].reason).toBe('missing document number');
  });

  it('counts documents, lines and closed lines', async () => {
    const { report } = await parsePOFileWithReport(csvFile('po-sample.csv'));
    expect(report.documents).toBe(2);
    expect(report.lines).toBe(4);
    expect(report.closedLines).toBe(1);
  });

  it('a clean file has nothing skipped and no warnings', () => {
    const { report } = parsePurchaseOrderRows([po(), po({ LineNum: '2', ItemCode: 'B' })]);
    expect(report.skipped).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('warns when a line number is missing, and numbers from file order', () => {
    const { orders, report } = parsePurchaseOrderRows([po({ LineNum: undefined }), po({ LineNum: undefined, ItemCode: 'B' })]);
    expect(orders[0].items.map((l) => l.LineNumber)).toEqual([1, 2]);
    expect(report.warnings.filter((w) => w.reason.includes('no LineNumber'))).toHaveLength(2);
  });

  it('skips a duplicate line number inside one document', () => {
    const { orders, report } = parsePurchaseOrderRows([po(), po({ ItemCode: 'B' })]);
    expect(orders[0].items).toHaveLength(1);
    expect(report.skipped).toEqual([expect.objectContaining({ row: 2, reason: 'duplicate LineNumber 1 in this document' })]);
  });

  it('caps received at ordered and warns', () => {
    const { orders, report } = parsePurchaseOrderRows([po({ ReceivedQty: '12', OpenQty: undefined })]);
    expect(orders[0].items[0]).toMatchObject({ OrderedQty: 10, ReceivedQty: 10, RemainingQty: 0 });
    expect(report.warnings.some((w) => w.reason.includes('more than ordered'))).toBe(true);
  });

  it('a blank expected date is left blank, an unreadable one is reported', () => {
    const bad = parsePurchaseOrderRows([po({ ReqDate: 'soon' })]);
    expect(bad.orders[0].expectedDate).toBe('');
    expect(bad.report.warnings[0].reason).toContain('"soon"');
  });

  it('refuses zero or non-numeric line numbers and quantities', () => {
    const { report, orders } = parsePurchaseOrderRows([
      po({ Quantity: '0' }), po({ LineNum: 'x', ItemCode: 'B' }), po({ ItemCode: 'C', Quantity: '1,5' }),
    ]);
    expect(orders).toEqual([]);
    expect(report.skipped.map((s) => s.reason)).toEqual([
      'ordered quantity must be above zero',
      'LineNumber "x" is not a whole number above zero',
      'ordered quantity is missing or not a number ("1,5")',
    ]);
  });

  it('warns when no received or open quantity is given, and counts nothing as done', () => {
    const { orders, report } = parsePurchaseOrderRows([po({ OpenQty: undefined })]);
    expect(orders[0].items[0].ReceivedQty).toBe(0);
    expect(report.warnings.some((w) => w.reason.includes('nothing counted as done'))).toBe(true);
  });

  it('throws a clear error when the file has no PO number column', () => {
    expect(() => parsePurchaseOrderRows([{ ItemCode: 'A', Quantity: '1' }])).toThrow(/No PO number column/);
  });
});

describe('11.5 XLSX reading', () => {
  it('reads the Purchase Orders sheet with date serials and text quantities', async () => {
    const { orders } = await parsePOFileWithReport(xlsxFile());
    expect(orders.map((o) => o.id)).toEqual(['po-5000001', 'po-5000002']);
    expect(orders[0].expectedDate).toBe('2026-11-01');
    expect(orders[0].items[0]).toMatchObject({ LineNumber: 1, OrderedQty: 1000, BinCode: '01-RACK-A1', Warehouse: '01' });
    expect(orders[0].items[1].BinCode).toBe('NO-BIN');
  });

  it('reads the Sales Orders sheet, not the Purchase Orders sheet', async () => {
    const { orders } = await parseSalesOrderFileWithReport(xlsxFile());
    expect(orders.map((o) => o.id)).toEqual(['so-7000001', 'so-7000002']);
  });

  it('a CSV serial date reads the same as the XLSX one', async () => {
    const { orders } = await parsePOFileWithReport(csvFile('po-sample.csv'));
    expect(orders[0].expectedDate).toBe('2026-11-01');
  });
});

describe('11.8 sales orders follow the same rules', () => {
  it('derives delivered from OpenQty and keeps pending status', () => {
    const { orders } = parseSalesOrderRows([so({ OpenQty: '4' })]);
    expect(orders[0].items[0]).toMatchObject({ OrderedQty: 10, DeliveredQty: 6, RemainingQty: 4 });
    expect(orders[0].status).toBe('picking');
  });

  it('reads ship-to fields and defaults the country to CA', () => {
    const { orders } = parseSalesOrderRows([so({ City: 'Toronto', Phone1: '555' })]);
    expect(orders[0]).toMatchObject({ shipToCity: 'Toronto', shipToPhone: '555', shipToCountry: 'CA' });
  });

  it('same SO file twice gives identical results, and repeated ItemCodes stay separate', async () => {
    const a = await parseSalesOrderFileWithReport(csvFile('so-sample.csv'));
    const b = await parseSalesOrderFileWithReport(csvFile('so-sample.csv'));
    expect(JSON.stringify(b.orders)).toBe(JSON.stringify(a.orders));
    expect(a.orders[0].items.map((l) => l.ItemCode)).toEqual(['ITEM-100', 'ITEM-100']);
  });

  it('throws a clear error when the file has no sales order number column', () => {
    expect(() => parseSalesOrderRows([{ ItemCode: 'A', OrderedQty: '1' }])).toThrow(/No sales order number column/);
  });
});
