// Builds the SAP import test fixtures in src/data/fixtures/.
//
// The shapes come from a real SAP PO export and a real SO export (2026-11-06): the same
// headers, the same cell types, the same quirks. Every VALUE here is invented. The repo
// is public, so real vendor/customer names, item codes and order numbers must never be
// copied in. Run `node scripts/make-import-fixtures.mjs` to regenerate.
//
// Quirks reproduced from the real files:
//  - "Due Date" is a real date cell (arrives as an Excel serial number, e.g. 46188)
//  - LineNumber is BLANK on the first line of most documents (SAP line 0), then 1..n
//  - Warehouse is the NUMBER 1 or 5 (Excel drops the leading zero of "01"/"05")
//  - BinCode is blank on every row
//  - PO uses "Quantity" + "Remaining Open Quantity"; SO uses "OrderedQty" + "DeliveredQty"
//  - SO quantities can be fractions; the same ItemCode can sit on several lines of one SO
//  - some item codes are lower case; descriptions contain commas and quotes
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'fixtures');
fs.mkdirSync(outDir, { recursive: true });

const serial = (iso) => Math.round((Date.UTC(...iso.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) - Date.UTC(1899, 11, 30)) / 86400000);
const dateCell = (iso) => ({ t: 'n', v: serial(iso), z: 'mm-dd-yy' });
const blank = null;

function sheetFrom(headers, rows, dateCol) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map((r) => r.map((v, i) => (i === dateCol ? blank : v)))]);
  rows.forEach((r, i) => {
    ws[XLSX.utils.encode_cell({ r: i + 1, c: dateCol })] = dateCell(r[dateCol]);
  });
  // aoa_to_sheet leaves null cells out, which is how the real files look (empty cell, not "").
  return ws;
}

function write(name, ws, sheetName = 'Sheet1') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, path.join(outDir, name));
  console.log('wrote', name);
}

// ---- Purchase orders -------------------------------------------------------------------
const poHeaders = ['Document Number', 'Customer/Vendor Code', 'Customer/Vendor Name', 'Due Date', 'LineNumber',
  'Item No.', 'Description', 'Quantity', 'Remaining Open Quantity', 'Warehouse', 'BinCode'];
const po = (doc, code, name, due, line, item, desc, qty, open, whs) =>
  [doc, code, name, due, line, item, desc, qty, open, whs, blank];

write('sap-po-export.xlsx', sheetFrom(poHeaders, [
  // single-line document whose only line is SAP line 0 (blank LineNumber)
  po(900001, 'V0001', 'TEST VENDOR ALPHA INC', '2026-06-15', blank, 'ITM-1000-AAA', 'Flange, 5.75" pilot; 6.5" bolt circle', 10, 10, 1),
  // lines 9 and 29: gaps in numbering, no blank line
  po(900002, 'V0002', 'TEST VENDOR BETA GMBH', '2026-05-15', 9, 'ITM-2000-BBB', 'Pump assembly', 1, 1, 1),
  po(900002, 'V0002', 'TEST VENDOR BETA GMBH', '2026-05-15', 29, 'ITM-2001-BBB', 'Fuel filter', 100, 100, 1),
  // blank line 0, then 1 and 2; line 1 is partly received in SAP already (open 1 of 2); warehouse 5
  po(900003, 'V0003', 'TEST VENDOR GAMMA LTD', '2026-10-15', blank, 'ITM-3000-CCC', 'Engine core', 2, 1, 5),
  po(900003, 'V0003', 'TEST VENDOR GAMMA LTD', '2026-10-15', 1, 'ITM-3001-CCC', 'Core kit', 2, 1, 5),
  po(900003, 'V0003', 'TEST VENDOR GAMMA LTD', '2026-10-15', 2, 'ITM-3002-CCC', 'Gasket set', 4, 4, 5),
  // the SAME ItemCode on two lines of one PO (5 and 3), plus another item
  po(900004, 'V0001', 'TEST VENDOR ALPHA INC', '2026-07-01', blank, 'ITM-4000-DDD', 'Bearing, "heavy duty"', 5, 5, 1),
  po(900004, 'V0001', 'TEST VENDOR ALPHA INC', '2026-07-01', 1, 'ITM-4000-DDD', 'Bearing, "heavy duty"', 3, 3, 1),
  po(900004, 'V0001', 'TEST VENDOR ALPHA INC', '2026-07-01', 2, 'ITM-4001-DDD', 'Seal kit', 8, 8, 1),
  // large quantity
  po(900005, 'V0004', 'TEST VENDOR DELTA CORP', '2027-01-08', blank, 'ITM-5000-EEE', 'Bolt M8, zinc', 1250, 1250, 1),
], 3));

// ---- Sales orders ----------------------------------------------------------------------
const soHeaders = ['Document Number', 'Customer/Vendor Code', 'Customer/Vendor Name', 'Due Date', 'LineNumber',
  'Item No.', 'Description', 'OrderedQty', 'DeliveredQty', 'Warehouse', 'BinCode'];
const so = (doc, code, name, due, line, item, desc, qty, del, whs) =>
  [doc, code, name, due, line, item, desc, qty, del, whs, blank];

write('sap-so-export.xlsx', sheetFrom(soHeaders, [
  so(910001, 'C0001', 'TEST CUSTOMER ONE', '2025-08-11', 2, 'ITM-1000-AAA', 'Engine, stage V', 1, 0, 1),
  // single line 0
  so(910002, 'C0002', 'TEST CUSTOMER TWO LTD (US)', '2026-12-31', blank, 'ITM-6000-FFF', 'Power pack 12V', 1, 0, 1),
  // fractional quantities
  so(910003, 'C0002', 'TEST CUSTOMER TWO LTD (US)', '2026-12-31', blank, 'ITM-7000-GGG', 'Hose, per metre', 3.5, 0, 1),
  so(910003, 'C0002', 'TEST CUSTOMER TWO LTD (US)', '2026-12-31', 1, 'ITM-7001-GGG', 'Cable, per metre', 0.25, 0, 1),
  // the same ItemCode (lower case on purpose) on four lines of one order
  so(910004, 'C0003', 'TEST CUSTOMER THREE', '2026-03-03', blank, 'itm-rep-01', 'Repeated part', 2, 0, 1),
  so(910004, 'C0003', 'TEST CUSTOMER THREE', '2026-03-03', 1, 'ITM-8000-HHH', 'Other part', 1, 0, 1),
  so(910004, 'C0003', 'TEST CUSTOMER THREE', '2026-03-03', 2, 'itm-rep-01', 'Repeated part', 5, 0, 1),
  so(910004, 'C0003', 'TEST CUSTOMER THREE', '2026-03-03', 3, 'itm-rep-01', 'Repeated part', 1, 0, 1),
  so(910004, 'C0003', 'TEST CUSTOMER THREE', '2026-03-03', 4, 'itm-rep-01', 'Repeated part', 4, 0, 1),
  // partly delivered in SAP; warehouse 5
  so(910005, 'C0004', 'TEST CUSTOMER FOUR', '2026-09-30', blank, 'ITM-9000-JJJ', 'Filter, "premium"', 130, 13, 5),
  so(910005, 'C0004', 'TEST CUSTOMER FOUR', '2026-09-30', 1, 'ITM-9001-JJJ', 'Gasket, large', 10, 0, 5),
], 3));

// ---- Edge cases that need real cell types (text dates, text numbers) -------------------
// SAP-style headers (DocNum / CardCode / Dscription / OpenQty / WhsCode) so the alias lists are
// exercised too. Rows: 2 valid, then one of each kind of bad cell.
{
  const headers = ['DocNum', 'CardCode', 'CardName', 'DocDueDate', 'LineNum', 'ItemCode', 'Dscription', 'Quantity', 'OpenQty', 'WhsCode'];
  const rows = [
    // text date, text quantity with a thousands separator
    [900101, 'V0009', 'TEST VENDOR EDGE', '2026-06-15', 0, 'EDG-0001', 'Text date and text quantity', '1,000', '1,000', '01'],
    // yyyymmdd as a number, quantity with a decimal comma (French locale), warehouse as text "05"
    [900101, 'V0009', 'TEST VENDOR EDGE', 20260615, 1, 'EDG-0002', 'Second line', '2,5', '2,5', '05'],
    // order number stored as text with ".0" (what a CSV round trip through Excel produces)
    ['900102.0', 'V0009', 'TEST VENDOR EDGE', 46188, 0, 'EDG-0003', 'Doc number as text', 4, 4, 1],
    // bad rows: missing order number, missing item code, unreadable qty, zero qty, bad line number, duplicate line
    [null, 'V0009', 'TEST VENDOR EDGE', 46188, 0, 'EDG-0004', 'No order number', 1, 1, 1],
    [900103, 'V0009', 'TEST VENDOR EDGE', 46188, 0, null, 'No item code', 1, 1, 1],
    [900103, 'V0009', 'TEST VENDOR EDGE', 46188, 1, 'EDG-0005', 'Unreadable quantity', 'abc', 1, 1],
    [900103, 'V0009', 'TEST VENDOR EDGE', 46188, 2, 'EDG-0006', 'Zero quantity', 0, 0, 1],
    [900103, 'V0009', 'TEST VENDOR EDGE', 46188, -3, 'EDG-0007', 'Negative line number', 1, 1, 1],
    [900103, 'V0009', 'TEST VENDOR EDGE', 46188, 4, 'EDG-0008', 'Line 4 first time', 1, 1, 1],
    [900103, 'V0009', 'TEST VENDOR EDGE', 46188, 4, 'EDG-0009', 'Line 4 again (duplicate)', 1, 1, 1],
    // not skipped, but warned about: unreadable date, open quantity above the ordered quantity
    [900104, 'V0009', 'TEST VENDOR EDGE', 'soon', 0, 'EDG-0010', 'Bad date', 5, 5, 1],
    [900104, 'V0009', 'TEST VENDOR EDGE', 'soon', 1, 'EDG-0011', 'Open above ordered', 5, 9, 1],
  ];
  write('sap-po-edge-cases.xlsx', XLSX.utils.aoa_to_sheet([headers, ...rows]));
}
