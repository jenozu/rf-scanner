// Naming an order line to the server. A line imported from SAP carries a LineKey
// ("<DocNum>:<LineNumber>") that stays the same when a re-import adds, removes or re-orders lines,
// so a screen that is a few minutes old still hits the line the picker is looking at. Orders from
// before line keys existed have no key; they are addressed by position until they are re-imported.

export type LineRef = { lineKey: string } | { lineIndex: number };

export function lineRef(line: { LineKey?: string } | undefined, index: number): LineRef {
  return line?.LineKey ? { lineKey: line.LineKey } : { lineIndex: index };
}

/** Find a line again in the latest copy of an order: by key if it has one, else by position. */
export function findLine<T extends { LineKey?: string }>(items: T[] | undefined, ref: LineRef): { line: T; index: number } | undefined {
  const list = items ?? [];
  if ("lineKey" in ref) {
    const index = list.findIndex((l) => l.LineKey === ref.lineKey);
    return index < 0 ? undefined : { line: list[index], index };
  }
  const line = list[ref.lineIndex];
  return line ? { line, index: ref.lineIndex } : undefined;
}

/** The server's machine-readable reason for a refusal (OVER_PICK, SCAN_MISMATCH, ...), if any. */
export function errorCode(error: unknown): string | undefined {
  const code = (error as { details?: { code?: unknown } } | null)?.details?.code;
  return typeof code === "string" ? code : undefined;
}

export function errorDetail<T = number>(error: unknown, field: string): T | undefined {
  return (error as { details?: Record<string, T> } | null)?.details?.[field];
}

/** A fresh id for one pick or receipt; reusing it on a retry makes the retry harmless. */
export function newTxnId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

/** Item codes compare loosely (case, stray spaces), exactly as the server does. */
export const sameItemCode = (a: unknown, b: unknown) =>
  String(a ?? "").trim().toUpperCase() === String(b ?? "").trim().toUpperCase();

/** What is still open on a line (ordered minus received/delivered), never negative, free of 0.1+0.2 noise. */
export function openQty(line: { OrderedQty?: number; ReceivedQty?: number; DeliveredQty?: number }): number {
  const done = Number(line.ReceivedQty ?? line.DeliveredQty) || 0;
  return Math.max(0, Math.round(((Number(line.OrderedQty) || 0) - done) * 1e6) / 1e6);
}
