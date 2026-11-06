/**
 * Reading single spreadsheet cells: quantities and dates.
 * Shared by the SAP order importer and the master-inventory importer, so a "1,000" or an
 * Excel date cell means the same thing in every file the app reads.
 */

export const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** The text of a cell: numbers lose any ".0"; blank becomes "". */
export function cellText(v: unknown): string {
  if (isBlank(v)) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return String(v).trim();
}

/**
 * A quantity: 12, "12", "1,000", "1 000", "1.234,50", "2,5". Returns null when the cell is
 * blank or cannot be read (never 0, so "abc" cannot pass for "none").
 *
 * "1,234" is read as one thousand two hundred thirty-four (the owner's rule). A single comma
 * followed by one or two digits ("2,5", "12,50") is a decimal comma.
 */
export function parseQty(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (isBlank(value)) return null;
  // spaces, non-breaking/thin spaces and apostrophes are grouping marks (French/Swiss Excel)
  const text = String(value).replace(/[\s  ']/g, "");
  if (!/^[+-]?[\d.,]+$/.test(text)) return null;
  const sign = text.startsWith("-") ? -1 : 1;
  const body = text.replace(/^[+-]/, "");
  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // both present: the one that comes last is the decimal mark
    const decimalIsComma = lastComma > lastDot;
    const group = decimalIsComma ? /\./g : /,/g;
    normalized = body.replace(group, "").replace(decimalIsComma ? "," : ".", ".");
    if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  } else if (lastComma >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(body)) normalized = body.replace(/,/g, "");
    else if (/^\d+,\d{1,2}$/.test(body)) normalized = body.replace(",", ".");
    else return null;
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3}){2,}$/.test(body)) normalized = body.replace(/\./g, ""); // 1.234.567
    else if (/^\d*\.\d*$/.test(body) && /\d/.test(body)) normalized = body;
    else return null;
  } else {
    if (!/^\d+$/.test(body)) return null;
    normalized = body;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? sign * n : null;
}

export type SapDate = { kind: "blank" } | { kind: "ok"; iso: string } | { kind: "invalid" };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const monthNumber = (name: string): number | undefined =>
  MONTHS[name.slice(0, 4).toLowerCase()] ?? MONTHS[name.slice(0, 3).toLowerCase()];
const MIN_YEAR = 1990, MAX_YEAR = 2100; // a due date outside this is a misread column, not a date

function isoIfValid(y: number, m: number, d: number): SapDate {
  if (y < MIN_YEAR || y > MAX_YEAR || m < 1 || m > 12 || d < 1) return { kind: "invalid" };
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return { kind: "invalid" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return { kind: "ok", iso: `${y}-${pad(m)}-${pad(d)}` };
}

/**
 * A SAP/Excel date -> "YYYY-MM-DD", with no time-zone arithmetic. Accepts Excel serial numbers
 * (46188), yyyymmdd, ISO text with or without a time, and day/month/year text only when it
 * cannot be misread. Blank stays blank; anything else is reported as invalid.
 */
export function parseSapDate(value: unknown): SapDate {
  if (isBlank(value)) return { kind: "blank" };
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? { kind: "invalid" } : isoIfValid(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const text = typeof value === "number" ? String(value) : String(value).trim();

  if (/^\d{8}$/.test(text)) {
    return isoIfValid(Number(text.slice(0, 4)), Number(text.slice(4, 6)), Number(text.slice(6, 8)));
  }
  if (/^\d+(\.\d+)?$/.test(text)) {
    // Excel serial number: days since 1899-12-30 (the time of day is dropped)
    const day = Math.floor(Number(text));
    if (day < 1) return { kind: "invalid" };
    const d = new Date(Date.UTC(1899, 11, 30) + day * 86400000);
    return isoIfValid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (m) return isoIfValid(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (a > 12) return isoIfValid(y, b, a); // 15/06/2026
    if (b > 12) return isoIfValid(y, a, b); // 06/15/2026
    return a === b ? isoIfValid(y, a, b) : { kind: "invalid" }; // 03/04/2026 could be either: do not guess
  }
  m = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]+(\d{4})$/.exec(text); // 15-Jun-2026
  if (m && monthNumber(m[2])) return isoIfValid(Number(m[3]), monthNumber(m[2])!, Number(m[1]));
  m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/.exec(text); // Jun 15, 2026
  if (m && monthNumber(m[1])) return isoIfValid(Number(m[3]), monthNumber(m[1])!, Number(m[2]));
  return { kind: "invalid" };
}

