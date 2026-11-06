/**
 * SAP purchase-order and sales-order import (CSV or XLSX).
 *
 * Built from a real SAP export, whose shape differs from the sample the app was first written
 * for: headers like "Document Number" / "Item No." / "Remaining Open Quantity", real date
 * cells (they arrive as Excel serial numbers), a BLANK LineNumber on the first line of a
 * document (SAP line 0), and a numeric Warehouse (1, not "01"). The old importer recognised
 * none of those headers and skipped every row with only a console warning.
 *
 * Rules this file keeps:
 *  - Nothing is dropped silently. Every skipped row is listed in the report with its row
 *    number and the reason; things that were read but look odd are listed as warnings.
 *  - A file with no readable order numbers / item codes / quantities is REJECTED with the
 *    list of columns that were found, never imported as nothing.
 *  - A line is identified by DocNum + LineNumber (the order id is po-<DocNum> / so-<DocNum>),
 *    so importing the same file twice, or on two devices, describes the same records.
 *  - A bad date is left blank. It is never replaced by today's date.
 *  - Warehouse and Bin stay separate fields; a warehouse code is never turned into a bin.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { extractBinAndWarehouse } from "./csv-utils";
import { cellText, isBlank, parseQty, parseSapDate } from "./cell-parsing";
export { parseQty, parseSapDate } from "./cell-parsing";
export type { SapDate } from "./cell-parsing";
import { makeLineKey, normalizeDocNum, orderId, roundQty } from "../../server/order-identity.js";
import type { PurchaseOrder, POItem, SalesOrder, SOItem } from "../types";

// ---------------------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------------------

export type SkipReason =
  | "missing-doc-number"
  | "missing-item-code"
  | "invalid-quantity"
  | "invalid-line-number"
  | "duplicate-line";

export type WarningCode =
  | "blank-line-number" // read as SAP line 0 (the real exports leave line 0 empty)
  | "no-line-column" // lines were numbered by file order
  | "invalid-date" // left blank
  | "header-differs" // vendor/customer/date differs between lines of one order; the first value is used
  | "open-exceeds-ordered" // open quantity above ordered quantity; treated as nothing received/delivered
  | "invalid-open-quantity"
  | "done-exceeds-ordered"
  | "line-already-complete" // SAP already shows this line as fully received/delivered
  | "doc-entry-used"; // order number came from a DocEntry column, not DocNum

export interface ImportReport {
  kind: "po" | "so";
  fileName: string;
  sheet?: string;
  /** Every header found in the file, and which header was used for which meaning. */
  columns: { found: string[]; mapped: Record<string, string> };
  rowsRead: number;
  ordersFound: number;
  linesAccepted: number;
  skipped: Array<{ row: number; reason: SkipReason; message: string; docNum?: string; itemCode?: string }>;
  warnings: Array<{ code: WarningCode; count: number; message: string; rows: number[] }>;
}

export interface OrderImportResult<T> {
  orders: T[];
  report: ImportReport;
}

/** The file cannot be imported. `report` (when present) says what was found. */
export class ImportError extends Error {
  report?: ImportReport;
  constructor(message: string, report?: ImportReport) {
    super(message);
    this.name = "ImportError";
    this.report = report;
  }
}

// ---------------------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------------------

const columnKey = (name: unknown) => String(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""); // "Item No." -> "itemno"

type Role =
  | "docNum" | "line" | "itemCode" | "description" | "ordered" | "open" | "done"
  | "cardCode" | "cardName" | "dueDate"
  | "shipToStreet" | "shipToCity" | "shipToProvince" | "shipToPostal" | "shipToCountry" | "shipToPhone";

// Each list is in priority order; the first alias found among the file's headers wins.
const COMMON_ROLES: Record<Role, string[]> = {
  docNum: ["documentnumber", "docnum", "ponumber", "sonumber", "ponum", "sonum", "purchaseorder", "salesorder",
    "purchaseordernumber", "salesordernumber", "docno", "orderno", "ordernumber", "order", "po", "so", "docentry"],
  line: ["linenumber", "linenum", "lineno", "line", "linenr", "lineid"],
  itemCode: ["itemno", "itemcode", "itemnumber", "itemnum", "item", "sku", "partnumber", "partno", "part"],
  description: ["description", "dscription", "itemdescription", "itemname", "desc", "name"],
  ordered: ["orderedqty", "quantity", "orderquantity", "qty", "orderedquantity"],
  open: ["remainingopenquantity", "openquantity", "openqty", "remainingquantity", "remainingqty", "remaining", "open"],
  done: [], // set per kind below
  cardCode: ["customervendorcode", "cardcode", "vendorcode", "customercode", "vendorid", "customerid"],
  cardName: ["customervendorname", "cardname", "vendorname", "customername", "vendor", "supplier", "suppliername", "customer"],
  dueDate: ["expecteddate", "reqdate", "requireddate", "duedate", "docduedate", "deliverydate", "docdate"],
  shipToStreet: ["shiptostreet", "address2", "street", "address"],
  shipToCity: ["shiptocity", "city"],
  shipToProvince: ["shiptoprovince", "county", "state", "province"],
  shipToPostal: ["shiptopostal", "zipcode", "postalcode", "zip", "postal"],
  shipToCountry: ["shiptocountry", "country"],
  shipToPhone: ["shiptophone", "phone1", "phone", "cellular"],
};
const DONE_ALIASES = {
  po: ["receivedqty", "receivedquantity", "received", "recvqty"],
  so: ["deliveredqty", "delivrdqty", "deliveredquantity", "shippedqty", "delivered"],
};
const ROLE_LABEL: Record<string, string> = {
  docNum: 'order number (e.g. "Document Number" or "DocNum")',
  itemCode: 'item code (e.g. "Item No." or "ItemCode")',
  ordered: 'quantity (e.g. "Quantity" or "OrderedQty")',
};

interface Mapping { index: Partial<Record<Role, number>>; mapped: Record<string, string> }

function resolveColumns(headers: string[], kind: "po" | "so"): Mapping {
  const keys = headers.map(columnKey);
  const index: Partial<Record<Role, number>> = {};
  const mapped: Record<string, string> = {};
  for (const role of Object.keys(COMMON_ROLES) as Role[]) {
    const aliases = role === "done" ? DONE_ALIASES[kind] : COMMON_ROLES[role];
    for (const alias of aliases) {
      const i = keys.indexOf(alias);
      if (i >= 0 && keys[i] !== "") {
        index[role] = i;
        mapped[role] = headers[i];
        break;
      }
    }
  }
  return { index, mapped };
}

const hasRequiredColumns = (headers: string[], kind: "po" | "so") => {
  const { index } = resolveColumns(headers, kind);
  return index.docNum !== undefined && index.itemCode !== undefined && index.ordered !== undefined;
};

// ---------------------------------------------------------------------------------------
// Reading a file into a table
// ---------------------------------------------------------------------------------------

export interface SheetTable {
  headers: string[];
  rows: Array<{ rowNumber: number; cells: unknown[] }>;
  sheetName?: string;
}

const nonEmpty = (row: unknown[]) => row.filter((c) => !isBlank(c)).length;

/** The header is the first row (within the first 10) with at least two filled cells. */
function tableFromGrid(grid: unknown[][], firstRowNumber: number, sheetName?: string): SheetTable {
  const headerAt = grid.slice(0, 10).findIndex((r) => nonEmpty(r) >= 2);
  if (headerAt < 0) return { headers: [], rows: [], sheetName };
  const headers = grid[headerAt].map((h) => cellText(h));
  const rows = grid
    .slice(headerAt + 1)
    .map((cells, i) => ({ rowNumber: firstRowNumber + headerAt + 1 + i, cells }))
    .filter((r) => nonEmpty(r.cells) > 0);
  return { headers, rows, sheetName };
}

const isExcelName = (name: string) => /\.(xlsx|xlsm|xls)$/i.test(name);

export async function readTableFromFile(file: File, kind: "po" | "so"): Promise<SheetTable> {
  if (isExcelName(file.name)) {
    const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" }); // dates stay serial numbers
    const preferred = kind === "po" ? /po|purchase/i : /so|sales|order/i;
    const names = [...workbook.SheetNames.filter((n) => preferred.test(n)), ...workbook.SheetNames.filter((n) => !preferred.test(n))];
    let first: SheetTable | null = null;
    for (const name of names) {
      const ws = workbook.Sheets[name];
      if (!ws || !ws["!ref"]) continue;
      const start = XLSX.utils.decode_range(ws["!ref"]).s.r;
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true, blankrows: true });
      const table = tableFromGrid(grid, start + 1, name);
      first = first ?? table;
      if (hasRequiredColumns(table.headers, kind)) return table;
    }
    return first ?? { headers: [], rows: [] };
  }
  const text = (await file.text()).replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false });
  return tableFromGrid(parsed.data as unknown[][], 1);
}

// ---------------------------------------------------------------------------------------
// The importer
// ---------------------------------------------------------------------------------------

interface Warnings { [code: string]: { count: number; rows: number[] } }

const WARNING_TEXT: Record<WarningCode, string> = {
  "blank-line-number": "LineNumber was blank and was read as SAP line 0",
  "no-line-column": "The file has no LineNumber column; lines were numbered by their order in the file",
  "invalid-date": "The date could not be read and was left blank",
  "header-differs": "Vendor/customer or date differs between lines of the same order; the first value was used",
  "open-exceeds-ordered": "Open quantity is above the ordered quantity; nothing was counted as received/delivered",
  "invalid-open-quantity": "Open quantity could not be read; nothing was counted as received/delivered",
  "done-exceeds-ordered": "Received/delivered quantity is above the ordered quantity",
  "line-already-complete": "SAP already shows this line as fully received/delivered",
  "doc-entry-used": "The order number came from a DocEntry column, not DocNum",
};

interface DocState {
  docNum: string;
  cardCode: string;
  cardName: string;
  dueDate: string;
  rowsSeen: number;
  address: Partial<Record<Role, string>>;
  lines: Array<POItem & SOItem>;
  keys: Set<string>;
}

function importRows(kind: "po" | "so", table: SheetTable, fileName: string): OrderImportResult<any> {
  const { index, mapped } = resolveColumns(table.headers, kind);
  const report: ImportReport = {
    kind, fileName, sheet: table.sheetName,
    columns: { found: table.headers.filter(Boolean), mapped },
    rowsRead: 0, ordersFound: 0, linesAccepted: 0, skipped: [], warnings: [],
  };
  const foundText = report.columns.found.join(", ") || "(none)";

  const missing = (["docNum", "itemCode", "ordered"] as const).filter((r) => index[r] === undefined);
  if (missing.length > 0) {
    throw new ImportError(
      `This file has no ${missing.map((r) => ROLE_LABEL[r]).join(" and no ")} column. Columns found: ${foundText}`,
      report
    );
  }
  if (table.rows.length === 0) throw new ImportError(`This file has no data rows. Columns found: ${foundText}`, report);

  const warnings: Warnings = {};
  const warn = (code: WarningCode, row: number) => {
    const w = (warnings[code] ??= { count: 0, rows: [] });
    w.count++;
    if (row > 0 && w.rows.length < 25) w.rows.push(row); // row 0 = about the whole file
  };
  const skip = (row: number, reason: SkipReason, message: string, docNum?: string, itemCode?: string) =>
    report.skipped.push({ row, reason, message, ...(docNum ? { docNum } : {}), ...(itemCode ? { itemCode } : {}) });

  if (mapped.docNum && columnKey(mapped.docNum) === "docentry") warn("doc-entry-used", 0);
  if (index.line === undefined) warn("no-line-column", 0);

  const docs = new Map<string, DocState>();
  const get = (cells: unknown[], role: Role) => (index[role] === undefined ? undefined : cells[index[role]!]);

  for (const { rowNumber, cells } of table.rows) {
    report.rowsRead++;

    const docNum = normalizeDocNum(get(cells, "docNum"));
    if (!docNum) { skip(rowNumber, "missing-doc-number", "No order number on this row"); continue; }

    const itemCode = cellText(get(cells, "itemCode"));
    const doc = docs.get(docNum) ?? { docNum, cardCode: "", cardName: "", dueDate: "", rowsSeen: 0, address: {}, lines: [], keys: new Set() };
    docs.set(docNum, doc);
    const positionInFile = doc.rowsSeen++; // used only when the file has no LineNumber column

    if (!itemCode) { skip(rowNumber, "missing-item-code", `Order ${docNum}: no item code on this row`, docNum); continue; }

    const orderedRaw = get(cells, "ordered");
    const ordered = parseQty(orderedRaw);
    if (ordered === null) {
      skip(rowNumber, "invalid-quantity", isBlank(orderedRaw)
        ? `Order ${docNum}, ${itemCode}: quantity is blank`
        : `Order ${docNum}, ${itemCode}: quantity "${cellText(orderedRaw)}" is not a number`, docNum, itemCode);
      continue;
    }
    if (ordered <= 0) { skip(rowNumber, "invalid-quantity", `Order ${docNum}, ${itemCode}: quantity is ${ordered}, it must be above zero`, docNum, itemCode); continue; }

    let lineNumber: number;
    if (index.line === undefined) {
      lineNumber = positionInFile;
    } else {
      const raw = get(cells, "line");
      if (isBlank(raw)) { lineNumber = 0; warn("blank-line-number", rowNumber); }
      else {
        const n = parseQty(raw);
        if (n === null || !Number.isInteger(n) || n < 0) {
          skip(rowNumber, "invalid-line-number", `Order ${docNum}, ${itemCode}: LineNumber "${cellText(raw)}" is not a whole number from 0 up`, docNum, itemCode);
          continue;
        }
        lineNumber = n;
      }
    }
    const lineKey = makeLineKey(docNum, lineNumber);
    if (doc.keys.has(lineKey)) {
      skip(rowNumber, "duplicate-line", `Order ${docNum}, line ${lineNumber}: this line appears twice in the file; the first one was kept`, docNum, itemCode);
      continue;
    }
    doc.keys.add(lineKey);

    // How much SAP already shows as received/delivered.
    const doneRaw = get(cells, "done");
    const openRaw = get(cells, "open");
    let done = 0;
    const doneParsed = parseQty(doneRaw);
    if (doneParsed !== null) {
      done = Math.max(0, doneParsed);
      if (done > ordered) warn("done-exceeds-ordered", rowNumber);
    } else if (!isBlank(openRaw)) {
      const open = parseQty(openRaw);
      if (open === null || open < 0) warn("invalid-open-quantity", rowNumber);
      else if (open > ordered) warn("open-exceeds-ordered", rowNumber);
      else done = roundQty(ordered - open);
    }
    if (done >= ordered) warn("line-already-complete", rowNumber);

    // Order header values: the first non-blank value wins; a conflicting later value is noted.
    const name = cellText(get(cells, "cardName")), code = cellText(get(cells, "cardCode"));
    if (!doc.cardName) doc.cardName = name; else if (name && name !== doc.cardName) warn("header-differs", rowNumber);
    if (!doc.cardCode) doc.cardCode = code; else if (code && code !== doc.cardCode) warn("header-differs", rowNumber);
    const date = parseSapDate(get(cells, "dueDate"));
    if (date.kind === "invalid") warn("invalid-date", rowNumber);
    else if (date.kind === "ok") {
      if (!doc.dueDate) doc.dueDate = date.iso; else if (date.iso !== doc.dueDate) warn("header-differs", rowNumber);
    }
    if (kind === "so") {
      for (const role of ["shipToStreet", "shipToCity", "shipToProvince", "shipToPostal", "shipToCountry", "shipToPhone"] as Role[]) {
        const v = cellText(get(cells, role));
        if (v && !doc.address[role]) doc.address[role] = v;
      }
    }

    // Warehouse and bin come from the row's own columns and are kept apart.
    const rowObject: Record<string, unknown> = {};
    table.headers.forEach((h, i) => { if (h && !(h in rowObject)) rowObject[h] = cells[i]; });
    const { binCode, warehouse } = extractBinAndWarehouse(rowObject);

    const remaining = roundQty(Math.max(0, ordered - done));
    const description = cellText(get(cells, "description")) || itemCode;
    const base = {
      LineNumber: lineNumber, LineKey: lineKey, ItemCode: itemCode, Description: description,
      OrderedQty: ordered, RemainingQty: remaining,
      ...(binCode ? { BinCode: binCode } : {}), ...(warehouse ? { Warehouse: warehouse } : {}),
    };
    doc.lines.push((kind === "po" ? { ...base, ReceivedQty: done } : { ...base, DeliveredQty: done }) as POItem & SOItem);
    report.linesAccepted++;
  }

  report.ordersFound = [...docs.values()].filter((d) => d.lines.length > 0).length;
  report.warnings = (Object.keys(warnings) as WarningCode[]).map((code) => ({
    code, count: warnings[code].count, message: WARNING_TEXT[code], rows: warnings[code].rows,
  }));

  if (report.linesAccepted === 0) {
    const why = report.skipped.slice(0, 3).map((s) => `row ${s.row}: ${s.message}`).join("; ");
    throw new ImportError(
      `No usable rows: all ${report.rowsRead} row(s) were skipped (${why}). Columns found: ${foundText}`,
      report
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const orders = [...docs.values()].filter((d) => d.lines.length > 0).map((doc) => {
    const items = [...doc.lines].sort((a, b) => (a.LineNumber ?? 0) - (b.LineNumber ?? 0));
    if (kind === "po") {
      const order: PurchaseOrder = {
        id: orderId("po", doc.docNum),
        poNumber: doc.docNum,
        vendor: doc.cardName || doc.cardCode || "Unknown Vendor",
        ...(doc.cardCode ? { cardCode: doc.cardCode } : {}),
        items: items as POItem[],
        status: (items as POItem[]).every((i) => i.ReceivedQty >= i.OrderedQty)
          ? "completed"
          : (items as POItem[]).some((i) => i.ReceivedQty > 0) ? "receiving" : "pending",
        expectedDate: doc.dueDate,
      };
      return order;
    }
    const so: SalesOrder = {
      id: orderId("so", doc.docNum),
      soNumber: doc.docNum,
      customer: doc.cardName || doc.cardCode || "Unknown Customer",
      cardCode: doc.cardCode,
      items: items as SOItem[],
      status: (items as SOItem[]).every((i) => i.DeliveredQty >= i.OrderedQty)
        ? "shipped"
        : (items as SOItem[]).some((i) => i.DeliveredQty > 0) ? "picking" : "pending",
      createdDate: today,
      ...(doc.dueDate ? { dueDate: doc.dueDate } : {}),
      ...(doc.address.shipToStreet ? { shipToStreet: doc.address.shipToStreet } : {}),
      ...(doc.address.shipToCity ? { shipToCity: doc.address.shipToCity } : {}),
      ...(doc.address.shipToProvince ? { shipToProvince: doc.address.shipToProvince } : {}),
      ...(doc.address.shipToPostal ? { shipToPostal: doc.address.shipToPostal } : {}),
      shipToCountry: doc.address.shipToCountry || "CA",
      ...(doc.address.shipToPhone ? { shipToPhone: doc.address.shipToPhone } : {}),
    };
    return so;
  });
  return { orders, report };
}

export const importPurchaseOrderRows = (table: SheetTable, fileName = "purchase orders"): OrderImportResult<PurchaseOrder> =>
  importRows("po", table, fileName);
export const importSalesOrderRows = (table: SheetTable, fileName = "sales orders"): OrderImportResult<SalesOrder> =>
  importRows("so", table, fileName);

export async function importPurchaseOrderFile(file: File): Promise<OrderImportResult<PurchaseOrder>> {
  return importPurchaseOrderRows(await readTableFromFile(file, "po"), file.name);
}
export async function importSalesOrderFile(file: File): Promise<OrderImportResult<SalesOrder>> {
  return importSalesOrderRows(await readTableFromFile(file, "so"), file.name);
}
