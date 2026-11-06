import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseQty, parseSapDate, ImportError,
  importPurchaseOrderFile, importSalesOrderFile,
  importPurchaseOrderRows, importSalesOrderRows,
  type SheetTable,
} from './sap-import';

const FIXTURES = path.join(__dirname, 'fixtures');
const fixtureFile = (name: string) => new File([fs.readFileSync(path.join(FIXTURES, name))], name);
const csvFile = (text: string, name = 'orders.csv') => new File([text], name);

/** Build a SheetTable from header + rows; the first data row is spreadsheet row 2. */
const table = (headers: string[], ...rows: unknown[][]): SheetTable => ({
  headers,
  rows: rows.map((cells, i) => ({ rowNumber: i + 2, cells })),
});

describe('parseQty', () => {
  it('reads plain numbers, numeric text and thousands separators', () => {
    expect(parseQty(12)).toBe(12);
    expect(parseQty('12')).toBe(12);
    expect(parseQty(' 12.5 ')).toBe(12.5);
    expect(parseQty('1,000')).toBe(1000);
    expect(parseQty('1,234,567')).toBe(1234567);
    expect(parseQty('1,000.50')).toBe(1000.5);
    expect(parseQty('1 000')).toBe(1000);
    expect(parseQty('1 000')).toBe(1000); // non-breaking space, as French-locale Excel writes it
    expect(parseQty('1 000,50')).toBe(1000.5);
    expect(parseQty('1.234,50')).toBe(1234.5);
  });

  it('reads a decimal comma when it cannot be a thousands separator', () => {
    expect(parseQty('2,5')).toBe(2.5);
    expect(parseQty('12,50')).toBe(12.5);
  });

  it('reads negatives and fractions', () => {
    expect(parseQty('-3')).toBe(-3);
    expect(parseQty(0.25)).toBe(0.25);
  });

  it('returns null for blank and unreadable values instead of 0', () => {
    expect(parseQty('')).toBeNull();
    expect(parseQty('   ')).toBeNull();
    expect(parseQty(null)).toBeNull();
    expect(parseQty(undefined)).toBeNull();
    expect(parseQty('abc')).toBeNull();
    expect(parseQty('12abc')).toBeNull();
    expect(parseQty('1,2345')).toBeNull();
    expect(parseQty('1e3')).toBeNull();
    expect(parseQty(NaN)).toBeNull();
    expect(parseQty(Infinity)).toBeNull();
  });
});

describe('parseSapDate', () => {
  it('converts Excel serial numbers (the +046327-01-01 bug)', () => {
    expect(parseSapDate(46188)).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate('46188')).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate(46188.75)).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate(45658)).toEqual({ kind: 'ok', iso: '2025-01-01' });
    expect(parseSapDate(46327)).toEqual({ kind: 'ok', iso: '2026-11-01' });
  });

  it('reads yyyymmdd, ISO dates (with or without a time) and slashes', () => {
    expect(parseSapDate(20260615)).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate('20260615')).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate('2026-06-15')).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate('2026-06-15 00:00:00.000')).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate('2026-06-15T23:59:59.000Z')).toEqual({ kind: 'ok', iso: '2026-06-15' }); // no time-zone shift
    expect(parseSapDate('2026/6/5')).toEqual({ kind: 'ok', iso: '2026-06-05' });
  });

  it('reads day/month/year only when it cannot be misread', () => {
    expect(parseSapDate('15/06/2026')).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate('06/15/2026')).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate('03/04/2026')).toEqual({ kind: 'invalid' }); // 3 April or 4 March: refuse to guess
    expect(parseSapDate('05/05/2026')).toEqual({ kind: 'ok', iso: '2026-05-05' }); // same either way
  });

  it('reads month names', () => {
    expect(parseSapDate('15-Jun-2026')).toEqual({ kind: 'ok', iso: '2026-06-15' });
    expect(parseSapDate('Jun 15, 2026')).toEqual({ kind: 'ok', iso: '2026-06-15' });
  });

  it('reports blank and unreadable dates and never invents today', () => {
    expect(parseSapDate('')).toEqual({ kind: 'blank' });
    expect(parseSapDate(null)).toEqual({ kind: 'blank' });
    expect(parseSapDate(undefined)).toEqual({ kind: 'blank' });
    expect(parseSapDate('soon')).toEqual({ kind: 'invalid' });
    expect(parseSapDate('2026-13-45')).toEqual({ kind: 'invalid' });
    expect(parseSapDate('2026-02-30')).toEqual({ kind: 'invalid' });
    expect(parseSapDate(45)).toEqual({ kind: 'invalid' }); // a small number is not a date
    expect(parseSapDate(99999999)).toEqual({ kind: 'invalid' });
  });
});

describe('real SAP PO export shape (anonymised fixture)', () => {
  it('imports every row: the headers are Document Number / Item No. / Remaining Open Quantity', async () => {
    const { orders, report } = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    expect(orders.map((o) => o.poNumber)).toEqual(['900001', '900002', '900003', '900004', '900005']);
    expect(orders.reduce((n, o) => n + o.items.length, 0)).toBe(10);
    expect(report.rowsRead).toBe(10);
    expect(report.ordersFound).toBe(5);
    expect(report.linesAccepted).toBe(10);
    expect(report.skipped).toEqual([]);
    expect(report.columns.mapped).toMatchObject({
      docNum: 'Document Number', itemCode: 'Item No.', ordered: 'Quantity', open: 'Remaining Open Quantity',
      cardCode: 'Customer/Vendor Code', cardName: 'Customer/Vendor Name', dueDate: 'Due Date', line: 'LineNumber',
    });
  });

  it('gives each order a deterministic id and each line a DocNum + LineNumber key', async () => {
    const { orders } = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    expect(orders.map((o) => o.id)).toEqual(['po-900001', 'po-900002', 'po-900003', 'po-900004', 'po-900005']);
    expect(orders[1].items.map((i) => i.LineKey)).toEqual(['900002:9', '900002:29']);
    expect(orders[1].items.map((i) => i.LineNumber)).toEqual([9, 29]);
  });

  it('reads a blank LineNumber as SAP line 0 and says so in the report', async () => {
    const { orders, report } = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    expect(orders[0].items[0].LineNumber).toBe(0);
    expect(orders[0].items[0].LineKey).toBe('900001:0');
    expect(orders[2].items.map((i) => i.LineKey)).toEqual(['900003:0', '900003:1', '900003:2']);
    const warning = report.warnings.find((w) => w.code === 'blank-line-number');
    expect(warning?.count).toBe(4); // 900001, 900003, 900004, 900005
  });

  it('keeps the same ItemCode on two lines as two lines', async () => {
    const { orders } = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    const po = orders.find((o) => o.poNumber === '900004')!;
    const same = po.items.filter((i) => i.ItemCode === 'ITM-4000-DDD');
    expect(same.map((i) => [i.LineKey, i.OrderedQty])).toEqual([['900004:0', 5], ['900004:1', 3]]);
  });

  it('reads the numeric warehouse as 01 / 05 and keeps it apart from the bin', async () => {
    const { orders } = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    expect(orders[0].items[0].Warehouse).toBe('01');
    expect(orders[2].items[0].Warehouse).toBe('05');
    for (const item of orders.flatMap((o) => o.items)) expect(item.BinCode).toBeUndefined();
  });

  it('turns date cells into ISO dates', async () => {
    const { orders } = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    expect(orders.map((o) => o.expectedDate)).toEqual(['2026-06-15', '2026-05-15', '2026-10-15', '2026-07-01', '2027-01-08']);
  });

  it('derives received quantity from the remaining open quantity', async () => {
    const { orders } = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    const line = orders[2].items[1]; // ordered 2, open 1
    expect(line.OrderedQty).toBe(2);
    expect(line.ReceivedQty).toBe(1);
    expect(line.RemainingQty).toBe(1);
    expect(orders[2].status).toBe('receiving');
    expect(orders[0].status).toBe('pending');
    expect(orders[4].items[0].OrderedQty).toBe(1250);
  });

  it('gives identical results when the same file is read twice', async () => {
    const a = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    const b = await importPurchaseOrderFile(fixtureFile('sap-po-export.xlsx'));
    expect(b.orders).toEqual(a.orders);
  });
});

describe('real SAP SO export shape (anonymised fixture)', () => {
  it('imports every row with OrderedQty / DeliveredQty', async () => {
    const { orders, report } = await importSalesOrderFile(fixtureFile('sap-so-export.xlsx'));
    expect(orders.map((o) => o.soNumber)).toEqual(['910001', '910002', '910003', '910004', '910005']);
    expect(orders.map((o) => o.id)).toEqual(['so-910001', 'so-910002', 'so-910003', 'so-910004', 'so-910005']);
    expect(report.rowsRead).toBe(11);
    expect(report.skipped).toEqual([]);
    expect(orders.reduce((n, o) => n + o.items.length, 0)).toBe(11);
  });

  it('keeps fractional quantities, lower-case item codes and repeated ItemCodes', async () => {
    const { orders } = await importSalesOrderFile(fixtureFile('sap-so-export.xlsx'));
    const frac = orders[2];
    expect(frac.items.map((i) => i.OrderedQty)).toEqual([3.5, 0.25]);
    const rep = orders[3];
    expect(rep.items.map((i) => i.LineKey)).toEqual(['910004:0', '910004:1', '910004:2', '910004:3', '910004:4']);
    expect(rep.items.filter((i) => i.ItemCode === 'itm-rep-01').map((i) => i.OrderedQty)).toEqual([2, 5, 1, 4]);
  });

  it('reads delivered quantity, the due date and warehouse 05', async () => {
    const { orders } = await importSalesOrderFile(fixtureFile('sap-so-export.xlsx'));
    const so = orders[4];
    expect(so.items[0]).toMatchObject({ OrderedQty: 130, DeliveredQty: 13, RemainingQty: 117, Warehouse: '05' });
    expect(so.status).toBe('picking');
    expect(so.dueDate).toBe('2026-09-30');
    expect(orders[0].dueDate).toBe('2025-08-11');
    expect(orders[0].items[0].LineNumber).toBe(2);
  });

  it('is deterministic apart from the created date', async () => {
    const a = await importSalesOrderFile(fixtureFile('sap-so-export.xlsx'));
    const b = await importSalesOrderFile(fixtureFile('sap-so-export.xlsx'));
    expect(b.orders.map((o) => ({ ...o, createdDate: '' }))).toEqual(a.orders.map((o) => ({ ...o, createdDate: '' })));
  });
});

describe('cells that are text, odd or wrong (edge-case workbook)', () => {
  it('reads "1,000" text quantities, text dates, yyyymmdd and a decimal comma', async () => {
    const { orders } = await importPurchaseOrderFile(fixtureFile('sap-po-edge-cases.xlsx'));
    const po = orders.find((o) => o.poNumber === '900101')!;
    expect(po.items[0]).toMatchObject({ ItemCode: 'EDG-0001', OrderedQty: 1000, Warehouse: '01', Description: 'Text date and text quantity' });
    expect(po.items[1]).toMatchObject({ ItemCode: 'EDG-0002', OrderedQty: 2.5, Warehouse: '05' });
    expect(po.expectedDate).toBe('2026-06-15');
  });

  it('cleans an order number that arrived as text with ".0" and converts a serial date', async () => {
    const { orders } = await importPurchaseOrderFile(fixtureFile('sap-po-edge-cases.xlsx'));
    const po = orders.find((o) => o.poNumber === '900102')!;
    expect(po.id).toBe('po-900102');
    expect(po.expectedDate).toBe('2026-06-15');
  });

  it('lists every skipped row with its spreadsheet row number and the reason', async () => {
    const { orders, report } = await importPurchaseOrderFile(fixtureFile('sap-po-edge-cases.xlsx'));
    const reasons = Object.fromEntries(report.skipped.map((s) => [s.row, s.reason]));
    expect(reasons).toEqual({
      5: 'missing-doc-number',
      6: 'missing-item-code',
      7: 'invalid-quantity', // "abc"
      8: 'invalid-quantity', // zero
      9: 'invalid-line-number',
      11: 'duplicate-line',
    });
    for (const s of report.skipped) expect(s.message.length).toBeGreaterThan(5);
    expect(report.rowsRead).toBe(12);
    expect(report.linesAccepted).toBe(6);
    expect(orders.map((o) => o.poNumber)).toEqual(['900101', '900102', '900103', '900104']);
    // the first of the two duplicate lines is kept, the second is not
    expect(orders.find((o) => o.poNumber === '900103')!.items.map((i) => i.ItemCode)).toEqual(['EDG-0008']);
  });

  it('warns (without skipping) about an unreadable date and an open quantity above the ordered quantity', async () => {
    const { orders, report } = await importPurchaseOrderFile(fixtureFile('sap-po-edge-cases.xlsx'));
    const po = orders.find((o) => o.poNumber === '900104')!;
    expect(po.expectedDate).toBe(''); // never replaced by today's date
    expect(po.items[1]).toMatchObject({ OrderedQty: 5, ReceivedQty: 0, RemainingQty: 5 });
    expect(report.warnings.find((w) => w.code === 'invalid-date')?.rows).toEqual([12, 13]);
    expect(report.warnings.find((w) => w.code === 'open-exceeds-ordered')?.rows).toEqual([13]);
  });

  it('maps SAP technical headers (DocNum, Dscription, OpenQty, WhsCode)', async () => {
    const { report } = await importPurchaseOrderFile(fixtureFile('sap-po-edge-cases.xlsx'));
    expect(report.columns.mapped).toMatchObject({
      docNum: 'DocNum', description: 'Dscription', open: 'OpenQty', line: 'LineNum', itemCode: 'ItemCode',
    });
  });
});

describe('files that cannot be read are rejected, not imported as nothing', () => {
  it('rejects a file with no order-number column and lists the columns it found', () => {
    const t = table(['Foo', 'Bar', 'ItemCode', 'Quantity'], ['x', 'y', 'A', 1]);
    try {
      importPurchaseOrderRows(t, 'bad.csv');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).message).toContain('order number');
      expect((e as ImportError).message).toContain('Foo, Bar, ItemCode, Quantity');
    }
  });

  it('rejects a file with no item-code column', () => {
    const t = table(['Document Number', 'Quantity'], [1, 2]);
    expect(() => importSalesOrderRows(t, 'bad.csv')).toThrow(/item code/i);
  });

  it('rejects a file with no quantity column', () => {
    const t = table(['Document Number', 'Item No.'], [1, 'A']);
    expect(() => importPurchaseOrderRows(t, 'bad.csv')).toThrow(/quantity/i);
  });

  it('rejects a file whose order numbers and item codes are all empty, with the report attached', () => {
    const t = table(['Document Number', 'Item No.', 'Quantity'], ['', '', 1], [null, null, 2]);
    try {
      importPurchaseOrderRows(t, 'empty.csv');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).report?.skipped.length).toBe(2);
      expect((e as ImportError).message).toContain('Document Number, Item No., Quantity');
    }
  });

  it('rejects a file with no data rows', () => {
    expect(() => importPurchaseOrderRows(table(['Document Number', 'Item No.', 'Quantity']), 'x.csv')).toThrow(/no data rows/i);
  });
});

describe('CSV files', () => {
  it('reads a SAP CSV with quoted thousands, a BOM, CRLF and blank separator lines, keeping row numbers', async () => {
    const text = '﻿Document Number,Customer/Vendor Name,Due Date,LineNumber,Item No.,Description,Quantity,Remaining Open Quantity,Warehouse\r\n'
      + '700001,"ACME, INC",2026-06-15,,A-1,"Part, 5"" long","1,000","1,000",1\r\n'
      + '\r\n'
      + '700001,"ACME, INC",2026-06-15,1,A-2,Second,2,2,1\r\n'
      + '700002,,2026-06-16,0,A-3,Third,3,3,5\r\n';
    const { orders, report } = await importPurchaseOrderFile(csvFile(text));
    expect(orders.map((o) => o.poNumber)).toEqual(['700001', '700002']);
    expect(orders[0].vendor).toBe('ACME, INC');
    expect(orders[0].items[0]).toMatchObject({ LineKey: '700001:0', OrderedQty: 1000, Description: 'Part, 5" long' });
    expect(orders[1].items[0].Warehouse).toBe('05');
    expect(report.rowsRead).toBe(3); // the blank line is not a row
  });

  it('numbers lines by file order (and says so) when the file has no LineNumber column', () => {
    const t = table(['poNumber', 'ItemCode', 'OrderedQty'], ['P1', 'A', 1], ['P1', 'A', 2], ['P2', 'B', 3]);
    const { orders, report } = importPurchaseOrderRows(t, 'old.csv');
    expect(orders[0].items.map((i) => i.LineKey)).toEqual(['P1:0', 'P1:1']);
    expect(report.warnings.find((w) => w.code === 'no-line-column')).toBeTruthy();
  });

  it('accepts the older column names (poNumber, vendor, expectedDate, ReceivedQty)', () => {
    const t = table(['poNumber', 'vendor', 'expectedDate', 'ItemCode', 'Description', 'OrderedQty', 'ReceivedQty'],
      ['P1', 'Acme', '2026-07-01', 'A', 'Part', 10, 4]);
    const { orders } = importPurchaseOrderRows(t, 'old.csv');
    expect(orders[0]).toMatchObject({ poNumber: 'P1', vendor: 'Acme', expectedDate: '2026-07-01' });
    expect(orders[0].items[0]).toMatchObject({ OrderedQty: 10, ReceivedQty: 4, RemainingQty: 6 });
  });
});

describe('sales order specifics', () => {
  it('derives delivered quantity from an open-quantity column when there is no delivered column', () => {
    const t = table(['Document Number', 'Item No.', 'Quantity', 'OpenQty'], [1, 'A', 10, 6]);
    const { orders } = importSalesOrderRows(t, 'so.csv');
    expect(orders[0].items[0]).toMatchObject({ OrderedQty: 10, DeliveredQty: 4, RemainingQty: 6 });
  });

  it('marks an order that SAP already shows as fully delivered', () => {
    const t = table(['Document Number', 'Item No.', 'OrderedQty', 'DeliveredQty'], [1, 'A', 2, 2]);
    const { orders, report } = importSalesOrderRows(t, 'so.csv');
    expect(orders[0].status).toBe('shipped');
    expect(report.warnings.find((w) => w.code === 'line-already-complete')?.count).toBe(1);
  });

  it('reads the ship-to address columns when present', () => {
    const t = table(['Document Number', 'Item No.', 'OrderedQty', 'Street', 'City', 'ZipCode'], [1, 'A', 2, '1 Main St', 'Laval', 'H7A 1A1']);
    const { orders } = importSalesOrderRows(t, 'so.csv');
    expect(orders[0]).toMatchObject({ shipToStreet: '1 Main St', shipToCity: 'Laval', shipToPostal: 'H7A 1A1' });
  });
});

// The lesson of the master import: tests built from a local snapshot passed while the real file
// failed. These run only when the real exports are available on this machine (never committed):
//   RF_REAL_PO_XLSX=/path/po.xlsx RF_REAL_SO_XLSX=/path/so.xlsx npx vitest run src/data/sap-import.test.ts
const realPo = process.env.RF_REAL_PO_XLSX;
const realSo = process.env.RF_REAL_SO_XLSX;
describe.skipIf(!realPo)('REAL PO export (local only)', () => {
  it('imports all 267 rows as 76 orders with no skipped rows', async () => {
    const { orders, report } = await importPurchaseOrderFile(new File([fs.readFileSync(realPo!)], 'po.xlsx'));
    expect(report.skipped).toEqual([]);
    expect(report.rowsRead).toBe(267);
    expect(orders.length).toBe(76);
    expect(orders.reduce((n, o) => n + o.items.length, 0)).toBe(267);
    expect(report.warnings.find((w) => w.code === 'blank-line-number')?.count).toBe(42);
    for (const o of orders) {
      expect(o.expectedDate).toMatch(/^20(2[5-9])-\d\d-\d\d$/);
      for (const i of o.items) expect(['01', '05']).toContain(i.Warehouse);
    }
    expect(new Set(orders.flatMap((o) => o.items.map((i) => i.LineKey))).size).toBe(267);
  });
});
describe.skipIf(!realSo)('REAL SO export (local only)', () => {
  it('imports all 417 rows as 154 orders; repeated ItemCodes stay separate lines', async () => {
    const { orders, report } = await importSalesOrderFile(new File([fs.readFileSync(realSo!)], 'so.xlsx'));
    expect(report.skipped).toEqual([]);
    expect(report.rowsRead).toBe(417);
    expect(orders.length).toBe(154);
    expect(orders.reduce((n, o) => n + o.items.length, 0)).toBe(417);
    expect(report.warnings.find((w) => w.code === 'blank-line-number')?.count).toBe(125);
    expect(new Set(orders.flatMap((o) => o.items.map((i) => i.LineKey))).size).toBe(417);
    const withRepeats = orders.filter((o) => new Set(o.items.map((i) => i.ItemCode)).size < o.items.length);
    expect(withRepeats.length).toBe(7);
  });
});
