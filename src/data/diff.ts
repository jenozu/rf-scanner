/**
 * Turn "the list before" and "the list after" (what a page handler computes) into
 * just the records that changed, so only those are sent to the server. Two devices
 * changing different records then never overwrite each other.
 */
import type { BinLocation } from "../types";

export interface RecordChanges<T extends { id: string }> {
  upsert: T[];
  remove: string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Records (with an id) that were added or modified, and ids that disappeared. */
export function diffRecords<T extends { id: string }>(before: T[], after: T[]): RecordChanges<T> {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const afterIds = new Set(after.map((r) => r.id));
  return {
    upsert: after.filter((r) => !same(beforeById.get(r.id), r)),
    remove: before.filter((r) => !afterIds.has(r.id)).map((r) => r.id),
  };
}

export interface BinChanges {
  newBins: Array<Pick<BinLocation, "BinCode" | "Zone" | "Capacity" | "Status">>;
  changes: Array<{ binCode: string; itemCode: string; description?: string; setQuantity: number }>;
}

/**
 * Bins created and item quantities set between two versions of the bin list.
 * Removing a bin or an item is not something the app does; if it happens the
 * save is refused instead of silently ignoring it.
 */
export function diffBins(before: BinLocation[], after: BinLocation[]): BinChanges {
  const beforeByCode = new Map(before.map((b) => [b.BinCode, b]));
  const afterCodes = new Set(after.map((b) => b.BinCode));
  for (const code of beforeByCode.keys()) {
    if (!afterCodes.has(code)) throw new Error(`Removing bin ${code} is not supported`);
  }

  const result: BinChanges = { newBins: [], changes: [] };
  for (const bin of after) {
    const old = beforeByCode.get(bin.BinCode);
    if (!old) {
      result.newBins.push({ BinCode: bin.BinCode, Zone: bin.Zone, Capacity: bin.Capacity, Status: bin.Status });
    }
    const oldItems = new Map((old?.Items ?? []).map((i) => [i.ItemCode, i]));
    const newCodes = new Set(bin.Items.map((i) => i.ItemCode));
    for (const code of oldItems.keys()) {
      if (!newCodes.has(code)) throw new Error(`Removing ${code} from bin ${bin.BinCode} is not supported`);
    }
    for (const item of bin.Items) {
      const prev = oldItems.get(item.ItemCode);
      if (!prev || prev.Quantity !== item.Quantity) {
        result.changes.push({
          binCode: bin.BinCode,
          itemCode: item.ItemCode,
          description: item.Description,
          setQuantity: item.Quantity,
        });
      }
    }
  }
  return result;
}
