/**
 * Purchase order and sales order imports (SAP exports, CSV or XLSX).
 *
 * Identity: a document is "po-<DocNum>" or "so-<DocNum>", and a line is its LineNumber
 * inside that document. Nothing uses the clock, so the same file always gives the same ids
 * and the server can recognise a repeat import (see applyOrderImport in server/ops-logic.js).
 *
 * Every row is either imported or listed in the report with a reason. Nothing is dropped
 * silently, and nothing is filled with 0 or today's date.
 */
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { extractBinAndWarehouse } from './csv-utils';
import { parseQty, parseSapDate } from './sap-values';
import type { POItem, PurchaseOrder, SalesOrder, SOItem } from '../types';

export type OrderKind = 'po' | 'so';

export interface ImportIssue {
  /** Data row number, not counting the header. */
  row: number;
  document?: string;
  reason: string;
}

export interface ImportReport {
  kind: OrderKind;
  /** Documents that have at least one imported line. */
  documents: number;
  /** Lines accepted. */
  lines: number;
  /** Accepted lines with nothing left open in the file (informational, they are imported). */
  closedLines: number;
  /** Rows that were not imported, with the reason. */
  skipped: ImportIssue[];
  /** Rows that were imported, but something was left blank, filled in or ignored. */
  warnings: ImportIssue[];
}

export interface OrderParseResult<T> {
  orders: T[];
  report: ImportReport;
}

type Row = Record<string, unknown>;

// Column names per file type. Matching ignores case, spaces, underscores and hyphens, and the
// first name in each list that has a value wins.
const PO_COLUMNS = {
  doc: ['DocNum', 'poNumber', 'PONumber', 'PONum', 'PO Number', 'Purchase Order', 'DocEntry'],
  party: ['CardName', 'vendor', 'VendorName', 'supplier'],
  partyCode: ['CardCode', 'VendorCode'],
  date: ['ReqDate', 'DocDueDate', 'DocDate', 'expectedDate', 'DueDate'],
  ordered: ['Quantity', 'OrderedQty', 'Qty'],
  received: ['ReceivedQty'],
  open: ['OpenQty', 'OpenQuantity'],
  description: ['Dscription', 'Description', 'ItemName'],
};

const SO_COLUMNS = {
  doc: ['soNumber', 'DocNum', 'DocEntry', 'OrderNumber', 'SO Number'],
  party: ['customer', 'CustomerName', 'CardName'],
  partyCode: ['CardCode', 'CustomerCode'],
  ordered: ['OrderedQty', 'Quantity', 'Qty'],
  delivered: ['DeliveredQty', 'DelivrdQty', 'ShippedQty'],
  open: ['OpenQty', 'OpenQuantity'],
  description: ['Description', 'Dscription', 'ItemName'],
  street: ['ShipToStreet', 'Address2', 'Street', 'Address'],
  city: ['ShipToCity', 'City'],
  province: ['ShipToProvince', 'County', 'State'],
  postal: ['ShipToPostal', 'ZipCode', 'PostalCode', 'Zip'],
  country: ['ShipToCountry', 'Country'],
  phone: ['ShipToPhone', 'Phone1', 'Phone', 'Cellular'],
};

const LINE_NUMBER = ['LineNumber', 'LineNum'];
const ITEM_CODE = ['ItemCode', 'Item', 'SKU'];

const keyOf = (name: string) => name.toLowerCase().replace(/[\s_\-]/g, '');
const text = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

/** One row, indexed by normalised column name, so each lookup is a single Map read. */
function indexRow(row: Row): Map<string, unknown> {
  const index = new Map<string, unknown>();
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    const key = keyOf(k);
    if (!index.has(key)) index.set(key, v);
  }
  return index;
}

function pick(index: Map<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    const v = index.get(keyOf(name));
    if (v !== undefined) return v;
  }
  return undefined;
}

const hasAnyColumn = (rows: Row[], names: string[]) =>
  rows.some((row) => names.some((name) => Object.keys(row).some((k) => keyOf(k) === keyOf(name))));

interface ParsedLine {
  row: number;
  lineNumber: number | null;
  itemCode: string;
  description: string;
  ordered: number;
  received?: number;
  delivered?: number;
  open?: number;
  bin?: string;
  warehouse?: string;
}

interface Group {
  doc: string;
  party: string;
  partyCode: string;
  date: string;
  shipTo?: Record<string, string | undefined>;
  lines: ParsedLine[];
}

/** Read the rows of an order file. XLSX cells keep their types; CSV text is parsed by PapaParse. */
export async function readOrderRows(file: File, kind: OrderKind): Promise<Row[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheetName = pickSheet(workbook.SheetNames, kind);
    const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1, defval: '', raw: true, blankrows: false,
    });
    return rowsFromGrid(grid);
  }
  const content = (await file.text()).replace(/^﻿/, '');
  const result = Papa.parse<Row>(content, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  if (result.errors.length > 0 && result.data.length === 0) throw new Error(result.errors[0].message);
  return result.data;
}

function pickSheet(names: string[], kind: OrderKind): string {
  const wanted = kind === 'po' ? /purchase|^po\b|po[_ ]lines/i : /sales|^so\b|so[_ ]lines/i;
  return names.find((n) => wanted.test(n)) ?? names[0];
}

function rowsFromGrid(grid: unknown[][]): Row[] {
  if (grid.length === 0) return [];
  const headers = grid[0].map((h) => text(h));
  return grid.slice(1).map((cells) => {
    const row: Row = {};
    headers.forEach((h, i) => {
      if (h !== '') row[h] = cells[i] ?? '';
    });
    return row;
  });
}

/** Parse PO rows into purchase orders with a report. */
export function parsePurchaseOrderRows(rows: Row[]): OrderParseResult<PurchaseOrder> {
  const report = newReport('po');
  const groups = groupRows(rows, 'po', report);
  const orders: PurchaseOrder[] = [];
  for (const g of groups.values()) {
    const items = finishLines(g, 'po', report) as POItem[];
    if (items.length === 0) continue;
    const received = items.reduce((sum, i) => sum + (i.ReceivedQty ?? 0), 0);
    const allReceived = items.every((i) => i.ReceivedQty >= i.OrderedQty);
    orders.push({
      id: `po-${g.doc}`,
      poNumber: g.doc,
      vendor: g.party || g.partyCode || 'Unknown Vendor',
      cardCode: g.partyCode || undefined,
      items,
      status: allReceived ? 'completed' : received > 0 ? 'receiving' : 'pending',
      expectedDate: g.date,
    });
  }
  report.documents = orders.length;
  return { orders, report };
}

/** Parse sales order rows into sales orders with a report. */
export function parseSalesOrderRows(rows: Row[]): OrderParseResult<SalesOrder> {
  const report = newReport('so');
  const groups = groupRows(rows, 'so', report);
  const orders: SalesOrder[] = [];
  for (const g of groups.values()) {
    const items = finishLines(g, 'so', report) as SOItem[];
    if (items.length === 0) continue;
    const allDone = items.every((i) => i.DeliveredQty >= i.OrderedQty);
    const anyDone = items.some((i) => i.DeliveredQty > 0);
    orders.push({
      id: `so-${g.doc}`,
      soNumber: g.doc,
      customer: g.party || 'Unknown Customer',
      cardCode: g.partyCode,
      shipToStreet: g.shipTo?.street,
      shipToCity: g.shipTo?.city,
      shipToProvince: g.shipTo?.province,
      shipToPostal: g.shipTo?.postal,
      shipToCountry: g.shipTo?.country,
      shipToPhone: g.shipTo?.phone,
      items,
      status: allDone ? 'shipped' : anyDone ? 'picking' : 'pending',
      createdDate: new Date().toISOString().split('T')[0],
    });
  }
  report.documents = orders.length;
  return { orders, report };
}

export async function parsePOFileWithReport(file: File): Promise<OrderParseResult<PurchaseOrder>> {
  return parsePurchaseOrderRows(await readOrderRows(file, 'po'));
}

export async function parseSalesOrderFileWithReport(file: File): Promise<OrderParseResult<SalesOrder>> {
  return parseSalesOrderRows(await readOrderRows(file, 'so'));
}

/** Orders only, for callers that do not show the report. */
export async function parsePOFile(file: File): Promise<PurchaseOrder[]> {
  return (await parsePOFileWithReport(file)).orders;
}

export async function parseSalesOrderFile(file: File): Promise<SalesOrder[]> {
  return (await parseSalesOrderFileWithReport(file)).orders;
}

function newReport(kind: OrderKind): ImportReport {
  return { kind, documents: 0, lines: 0, closedLines: 0, skipped: [], warnings: [] };
}

function groupRows(rows: Row[], kind: OrderKind, report: ImportReport): Map<string, Group> {
  const cols = kind === 'po' ? PO_COLUMNS : SO_COLUMNS;
  if (rows.length > 0 && !hasAnyColumn(rows, cols.doc)) {
    throw new Error(kind === 'po'
      ? 'No PO number column found (expected DocNum or poNumber).'
      : 'No sales order number column found (expected soNumber or DocNum).');
  }
  if (rows.length > 0 && !hasAnyColumn(rows, ITEM_CODE)) {
    throw new Error('No ItemCode column found.');
  }
  const groups = new Map<string, Group>();
  rows.forEach((raw, i) => {
    const row = i + 1;
    const index = indexRow(raw);
    const doc = text(pick(index, cols.doc));
    if (!doc) {
      skipRow(report, row, undefined, 'missing document number');
      return;
    }
    if (!groups.has(doc)) {
      groups.set(doc, {
        doc,
        party: text(pick(index, cols.party)),
        partyCode: text(pick(index, cols.partyCode)),
        date: '',
        shipTo: kind === 'so' ? shipToFrom(index) : undefined,
        lines: [],
      });
    }
    const group = groups.get(doc)!;
    if (kind === 'po') readDate(group, index, row, report);

    const itemCode = text(pick(index, ITEM_CODE));
    if (!itemCode) {
      skipRow(report, row, doc, 'missing ItemCode');
      return;
    }
    const orderedRaw = pick(index, cols.ordered);
    const ordered = parseQty(orderedRaw);
    if (ordered === null) {
      skipRow(report, row, doc, `ordered quantity is missing or not a number ("${text(orderedRaw) || 'blank'}")`);
      return;
    }
    if (ordered <= 0) {
      skipRow(report, row, doc, 'ordered quantity must be above zero');
      return;
    }
    const line: ParsedLine = {
      row,
      lineNumber: null,
      itemCode,
      description: text(pick(index, cols.description)) || itemCode,
      ordered,
    };
    const lineRaw = pick(index, LINE_NUMBER);
    if (lineRaw !== undefined) {
      const n = parseQty(lineRaw);
      if (n === null || !Number.isInteger(n) || n <= 0) {
        skipRow(report, row, doc, `LineNumber "${text(lineRaw)}" is not a whole number above zero`);
        return;
      }
      line.lineNumber = n;
    }
    if (!readQuantities(kind, cols, index, line, row, doc, report)) return;
    const bin = extractBinAndWarehouse(raw);
    line.bin = bin.binCode;
    line.warehouse = bin.warehouse;
    group.lines.push(line);
  });
  return groups;
}

/** Quantities for the line. Returns false (and records the skip) when they cannot be read. */
function readQuantities(
  kind: OrderKind,
  cols: typeof PO_COLUMNS | typeof SO_COLUMNS,
  index: Map<string, unknown>,
  line: ParsedLine,
  row: number,
  doc: string,
  report: ImportReport,
): boolean {
  const openRaw = pick(index, cols.open);
  if (openRaw !== undefined) {
    const open = parseQty(openRaw);
    if (open === null) {
      skipRow(report, row, doc, `open quantity is not a number ("${text(openRaw)}")`);
      return false;
    }
    line.open = open;
  }
  const doneRaw = pick(index, kind === 'po' ? PO_COLUMNS.received : SO_COLUMNS.delivered);
  if (doneRaw !== undefined) {
    const done = parseQty(doneRaw);
    if (done === null) {
      skipRow(report, row, doc, `${kind === 'po' ? 'received' : 'delivered'} quantity is not a number ("${text(doneRaw)}")`);
      return false;
    }
    if (kind === 'po') line.received = done; else line.delivered = done;
  } else if (line.open !== undefined) {
    const done = Math.max(0, line.ordered - line.open);
    if (kind === 'po') line.received = done; else line.delivered = done;
  }
  return true;
}

function readDate(group: Group, index: Map<string, unknown>, row: number, report: ImportReport) {
  const raw = pick(index, PO_COLUMNS.date);
  if (raw === undefined) return;
  const iso = parseSapDate(raw);
  if (iso === null) {
    pushIssue(report, group.doc, row, 'warning', `expected date "${text(raw)}" could not be read and was left blank`);
    return;
  }
  if (group.date === '') group.date = iso;
}

function shipToFrom(index: Map<string, unknown>) {
  const pickText = (names: string[]) => text(pick(index, names)) || undefined;
  return {
    street: pickText(SO_COLUMNS.street),
    city: pickText(SO_COLUMNS.city),
    province: pickText(SO_COLUMNS.province),
    postal: pickText(SO_COLUMNS.postal),
    country: pickText(SO_COLUMNS.country) ?? 'CA',
    phone: pickText(SO_COLUMNS.phone),
  };
}

/** Turn a group's parsed lines into items: deterministic LineNumbers, no duplicates. */
function finishLines(group: Group, kind: OrderKind, report: ImportReport): Array<POItem | SOItem> {
  const seen = new Set<number>();
  let next = 0;
  for (const l of group.lines) if (l.lineNumber !== null) next = Math.max(next, l.lineNumber);
  const out: Array<POItem | SOItem> = [];
  for (const line of group.lines) {
    let lineNumber = line.lineNumber;
    if (lineNumber === null) {
      next += 1;
      lineNumber = next;
      pushIssue(report, group.doc, line.row, 'warning', `no LineNumber; numbered ${lineNumber} from file order`);
    }
    if (seen.has(lineNumber)) {
      pushIssue(report, group.doc, line.row, 'skipped', `duplicate LineNumber ${lineNumber} in this document`);
      continue;
    }
    seen.add(lineNumber);
    const done = kind === 'po' ? line.received : line.delivered;
    if (done !== undefined && done > line.ordered) {
      pushIssue(report, group.doc, line.row, 'warning', `received or delivered (${done}) is more than ordered (${line.ordered}); capped at ordered`);
    }
    if (done === undefined) {
      pushIssue(report, group.doc, line.row, 'warning', `no ${kind === 'po' ? 'ReceivedQty or OpenQty' : 'DeliveredQty or OpenQty'} column value; nothing counted as done`);
    }
    const doneCapped = done === undefined ? 0 : Math.min(done, line.ordered);
    if (line.open === 0) report.closedLines += 1;
    report.lines += 1;
    if (kind === 'po') {
      out.push({
        LineNumber: lineNumber,
        ItemCode: line.itemCode,
        Description: line.description,
        OrderedQty: line.ordered,
        ReceivedQty: doneCapped,
        RemainingQty: line.ordered - doneCapped,
        BinCode: line.bin,
        Warehouse: line.warehouse,
      } as POItem);
    } else {
      out.push({
        LineNumber: lineNumber,
        ItemCode: line.itemCode,
        Description: line.description,
        OrderedQty: line.ordered,
        DeliveredQty: doneCapped,
        RemainingQty: line.ordered - doneCapped,
        BinCode: line.bin,
        Warehouse: line.warehouse,
      } as SOItem);
    }
  }
  out.sort((a, b) => (a.LineNumber ?? 0) - (b.LineNumber ?? 0));
  return out;
}

function skipRow(report: ImportReport, row: number, document: string | undefined, reason: string) {
  pushIssue(report, document, row, 'skipped', reason);
}

function pushIssue(report: ImportReport, document: string | undefined, row: number, level: 'skipped' | 'warning', reason: string) {
  (level === 'skipped' ? report.skipped : report.warnings).push({ row, document, reason });
}
