/**
 * Is there enough stock in the bin for what an order line needs?
 *
 * Used on the picking screens to warn about partial or missing stock before the
 * picker walks to the shelf. It only reads the bin list; it never changes anything.
 * Bin numbers can be out of date, so the warning informs the picker, it does not block.
 */
import type { BinLocation } from "../types";
import { classifyBin } from "../../server/ops-logic.js";

export type StockStatus =
  | "ok"          // the bin holds enough for this line
  | "partial"     // the bin holds some, but less than the line needs
  | "none"        // the bin holds none of this item
  | "needs-bin"   // no real bin on the line (blank, placeholder, SAP system bin, or a warehouse code)
  | "unknown-bin"; // a real-looking bin that is not in the system, so stock cannot be checked

export interface StockLine {
  binCode?: string;
  /** The line's SAP warehouse code, used to recognise a bin value that is really a warehouse. */
  warehouse?: string;
  itemCode: string;
  /** Quantity still to pick on this line. */
  needed: number;
}

export interface StockResult {
  status: StockStatus;
  needed: number;
  /** What the bin holds in total for this item (null when the bin is unknown). */
  inBin: number | null;
  /** What is left for THIS line after earlier lines in the same bin took theirs. */
  available: number | null;
  /** How many are missing for this line (0 when ok). */
  short: number;
  /** Other bins that hold this item, most stock first (at most 3). */
  elsewhere: Array<{ binCode: string; quantity: number }>;
}

const norm = (value: string | undefined) => (value ?? "").trim().toUpperCase();

function quantityIn(bin: BinLocation, itemCode: string): number {
  return bin.Items.filter((i) => norm(i.ItemCode) === itemCode).reduce((sum, i) => sum + (Number(i.Quantity) || 0), 0);
}

/**
 * Check lines in the order given. Lines that take from the same bin and item share
 * its stock: the second line only sees what the first one left.
 */
export function checkStock(lines: StockLine[], bins: BinLocation[]): StockResult[] {
  const binByCode = new Map(bins.map((b) => [norm(b.BinCode), b]));
  const taken = new Map<string, number>(); // "BIN|ITEM" -> already reserved by earlier lines

  return lines.map((line) => {
    const itemCode = norm(line.itemCode);
    const binCode = norm(line.binCode);
    const needed = Math.max(0, Number(line.needed) || 0);

    const elsewhere = bins
      .filter((b) => norm(b.BinCode) !== binCode)
      .map((b) => ({ binCode: b.BinCode, quantity: quantityIn(b, itemCode) }))
      .filter((o) => o.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);

    // A line without a real bin is not checked here: it must be given a bin first.
    if (!classifyBin(line.binCode, line.warehouse).real) {
      return { status: "needs-bin", needed, inBin: null, available: null, short: 0, elsewhere };
    }
    const bin = binByCode.get(binCode);
    if (!bin) {
      return { status: "unknown-bin", needed, inBin: null, available: null, short: 0, elsewhere };
    }

    const inBin = quantityIn(bin, itemCode);
    const key = `${binCode}|${itemCode}`;
    const available = Math.max(0, inBin - (taken.get(key) ?? 0));
    taken.set(key, (taken.get(key) ?? 0) + Math.min(needed, available));

    const status: StockStatus = needed === 0 || available >= needed ? "ok" : available <= 0 ? "none" : "partial";
    return { status, needed, inBin, available, short: Math.max(0, needed - available), elsewhere };
  });
}

export interface StockSummary {
  /** Lines with some stock, but not enough. */
  partial: number;
  /** Lines with no stock at all in their bin. */
  none: number;
  /** Lines that need a real bin assigned before they can be picked. */
  needsBin: number;
  /** Lines whose bin is not in the system, so stock could not be checked. */
  unchecked: number;
}

export function summarizeStock(results: StockResult[]): StockSummary {
  return {
    partial: results.filter((r) => r.status === "partial").length,
    none: results.filter((r) => r.status === "none").length,
    needsBin: results.filter((r) => r.status === "needs-bin").length,
    unchecked: results.filter((r) => r.status === "unknown-bin").length,
  };
}
