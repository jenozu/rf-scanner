// How an imported order and its lines are identified. Shared by the file importer in the
// browser (src/data/sap-import.ts) and by the server's import/merge, so the id a browser
// computes and the id the server stores can never drift apart. Browser-safe: no Node imports.
//
//   order id  = po-<DocNum> / so-<DocNum>   (never time-based: the same SAP document is the
//                                            same record on every device, every import)
//   line key  = <DocNum>:<LineNumber>        (SAP's own line number; a blank cell is line 0)

export const QTY_EPSILON = 1e-6;

/** Quantities are rounded so 0.1 + 0.2 style noise never decides "is there enough". */
export const roundQty = (n) => Math.round(n * 1e6) / 1e6;

/** "410167", 410167, " 410167 ", "410167.0", "410,167" -> "410167". Blank -> "". */
export function normalizeDocNum(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value).trim();
  if (!text) return '';
  if (/^\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, '');
  const whole = /^(\d+)\.0+$/.exec(text);
  if (whole) text = whole[1];
  return text;
}

/** kind is 'po' or 'so'. Percent-encoding keeps odd document numbers unique and URL-safe. */
export const orderId = (kind, docNum) => `${kind}-${encodeURIComponent(normalizeDocNum(docNum))}`;

export const makeLineKey = (docNum, lineNumber) => `${normalizeDocNum(docNum)}:${lineNumber}`;

/** Same ItemCode? SAP codes appear in mixed case in exports and on labels; compare loosely. */
export const sameCode = (a, b) =>
  String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();
