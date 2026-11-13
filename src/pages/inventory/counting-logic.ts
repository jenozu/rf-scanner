// Pure counting rules, kept apart from the screens so they can be tested on their own.
import type { BinLocation, CycleCount, Item } from "../../types";
import { compareBinCodes, isBinInRange } from "../../utils/bin-order";
import type { SequentialCountItem, SessionCountLog } from "./types";

export type BinSelection =
  | { ok: true; bins: BinLocation[]; startBin: string; endBin: string }
  | { ok: false; message: string };

/**
 * The bins a sequential count covers, in bin order (numeric-aware), plus the first and last bin,
 * which are what gets locked. "aisle" takes every bin starting with the aisle prefix;
 * "range" takes every bin between the two codes, in either order.
 */
export function selectBinsForCount(
  bins: BinLocation[],
  filter: { mode: "aisle" | "range"; aisle?: string; startBin?: string; endBin?: string }
): BinSelection {
  const sorted = [...bins].sort((a, b) => compareBinCodes(a.BinCode, b.BinCode));

  if (filter.mode === "aisle") {
    const prefix = (filter.aisle || "").trim().toUpperCase();
    if (!prefix) return { ok: false, message: "⚠️ Please enter an aisle code" };
    const selected = sorted.filter((bin) => bin.BinCode.toUpperCase().startsWith(prefix));
    if (selected.length === 0) {
      return { ok: false, message: `⚠️ No bins found starting with "${prefix}". Check your bin codes format.` };
    }
    return { ok: true, bins: selected, startBin: selected[0].BinCode, endBin: selected[selected.length - 1].BinCode };
  }

  const startBin = (filter.startBin || "").trim().toUpperCase();
  const endBin = (filter.endBin || "").trim().toUpperCase();
  if (!startBin || !endBin) return { ok: false, message: "⚠️ Please enter both start and end bin codes" };
  const selected = sorted.filter((bin) => isBinInRange(bin.BinCode, startBin, endBin));
  if (selected.length === 0) return { ok: false, message: "⚠️ No bins found in the specified range" };
  return { ok: true, bins: selected, startBin, endBin };
}

/** Every item in the given bins, in bin order, as the list a counter walks through. */
export function buildSequentialItems(bins: BinLocation[]): SequentialCountItem[] {
  return bins.flatMap((bin) =>
    (bin.Items || []).map((item) => ({
      binCode: bin.BinCode,
      zone: bin.Zone,
      itemCode: item.ItemCode,
      description: item.Description,
      expectedQty: item.Quantity,
    }))
  );
}

// A CSV field, quoted when it holds a comma, quote or line break (descriptions often have commas).
function csvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const COUNT_LOG_CSV_HEADERS = [
  "Session ID", "Session Name", "Username", "Timestamp", "Bin Code", "Item Code",
  "Description", "Expected Qty", "Counted Qty", "Variance",
];

/** The session's count log as CSV text. */
export function countLogsToCsv(logs: SessionCountLog[]): string {
  const rows = logs.map((log) => [
    log.sessionId, log.sessionName, log.username, log.timestamp, log.binCode, log.itemCode,
    log.description, log.expectedQty, log.countedQty, log.variance,
  ]);
  return [COUNT_LOG_CSV_HEADERS, ...rows].map((row) => row.map(csvField).join(",")).join("\n");
}

/** Rows from an uploaded full-count file as count records. A row without a counted quantity stays pending. */
export function uploadedRowsToCounts(rows: Item[], stamp = Date.now()): CycleCount[] {
  return rows.map((item, index) => ({
    id: `full-count-${stamp}-${index}`,
    BinCode: item.BinCode,
    ItemCode: item.ItemCode,
    ExpectedQty: item.ExpectedQty,
    CountedQty: item.CountedQty ?? 0,
    Variance: item.Variance ?? 0,
    Status: item.CountedQty !== undefined ? "counted" : "pending",
  }));
}
