/**
 * Value readers for SAP exports. Each returns null when it cannot read a value, so the
 * caller can report the row. Nothing here falls back to 0 or to today's date.
 * Pure TypeScript with no browser or Node imports.
 */

const MS_PER_DAY = 86_400_000;
// Excel serial 1 is 1900-01-01 and serials from 61 on match this base (the 1900 leap-year bug
// makes serials below 61 unusable for real dates, so they are rejected).
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MIN_SERIAL = 61;
const MAX_SERIAL = 2_958_465; // 9999-12-31

/** Quantity from a number or text. Accepts "1,000" and "1 000"; rejects "1.000,50" and junk. */
export function parseQty(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const s = value.replace(/[\s ]/g, '');
  if (s === '') return null;
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < MIN_SERIAL || whole > MAX_SERIAL) return null;
  const d = new Date(EXCEL_EPOCH_MS + whole * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Date as YYYY-MM-DD from an Excel serial (number or digits), yyyymmdd, yyyy-mm-dd (a time
 * after it is ignored), yyyy/mm/dd, or a Date object (its local calendar date).
 * Anything else, including ambiguous forms such as 03/11/2026, returns null.
 */
export function parseSapDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : validDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') return excelSerialToIso(value);
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (s === '') return null;

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (compact) return validDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));

  const iso = /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T].*)?$/.exec(s);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  if (/^\d+(\.\d+)?$/.test(s)) return excelSerialToIso(Number(s));
  return null;
}
