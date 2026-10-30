/**
 * Every change to warehouse data goes through here. Each function waits for the
 * server, reloads the collections it touched, and throws if the save failed
 * (the failure also shows in the sync indicator), so a page can only report
 * success when the server really has the change.
 */
import { api, ApiError } from "../services/api";
import { dataStore } from "./hooks";
import { diffBins, diffRecords } from "./diff";
import type { BinLocation } from "../types";

type ApiParams<K extends keyof typeof api> = Parameters<(typeof api)[K] extends (...a: any) => any ? (typeof api)[K] : never>;

/** Add log/transaction records (newest first). Retrying the same ids is safe. */
export function appendRecords(
  key: "rf_receiving_txns" | "rf_cycle_count_txns" | "rf_activity_logs" | "rf_session_count_logs", records: Array<{ id: string }>) {
  return dataStore.mutate(() => api.appendRecords(key, records), { reload: [key] });
}

/** Change one item's quantity in one bin (delta or absolute). */
export function adjustBin(params: ApiParams<"adjustBin">[0]) {
  return dataStore.mutate(() => api.adjustBin(params), { reload: ["rf_bins"] });
}

/** Receive quantity against exactly one PO line, identified by its position. */
export function receivePoLine(params: ApiParams<"receivePoLine">[0]) {
  return dataStore.mutate(() => api.receivePoLine(params), { reload: ["rf_purchase_orders"] });
}

/** Pick quantity against exactly one sales-order line, identified by its position. */
export function pickSoLine(params: ApiParams<"pickSoLine">[0]) {
  return dataStore.mutate(() => api.pickSoLine(params), { reload: ["rf_sales_orders"] });
}

/**
 * Receive stock: updates the PO line, the bin and the receiving log together.
 * The txnId makes a retry harmless; if the first attempt actually went through,
 * the second one is reported as duplicate and changes nothing.
 */
export function receiveStock(params: ApiParams<"receiveStock">[0]) {
  return dataStore.mutate(() => api.receiveStock(params), {
    reload: ["rf_purchase_orders", "rf_bins", "rf_receiving_txns"],
  });
}

/** Pick against one sales-order line and take the stock from its bin. */
export function pickSalesOrderLine(params: ApiParams<"pickSalesOrderLine">[0]) {
  return dataStore.mutate(() => api.pickSalesOrderLine(params), {
    reload: ["rf_sales_orders", "rf_bins"],
  });
}

type RecordKey =
  | "rf_purchase_orders" | "rf_sales_orders" | "rf_waves" | "rf_orders"
  | "rf_cycle_counts" | "rf_inventory_sessions" | "rf_temporary_locations";

export function upsertRecord(key: RecordKey, record: { id: string }) {
  return dataStore.mutate(() => api.upsertRecord(key, record), { reload: [key] });
}

export function deleteRecord(key: RecordKey, id: string) {
  return dataStore.mutate(() => api.deleteRecord(key, id), { reload: [key] });
}

export function upsertManyRecords(key: RecordKey, records: Array<{ id: string }>, skipExisting = false) {
  return dataStore.mutate(() => api.upsertManyRecords(key, records, skipExisting), { reload: [key] });
}

/**
 * Replace a whole collection (imports, settings). If the collection changed on the
 * server since this device last loaded it, the save is refused (HTTP 409), the
 * fresh copy is loaded, and the error is thrown so the page can tell the user.
 * overwrite: true skips that check (an explicit "replace everything"). reload: false
 * skips re-downloading the saved collection (large files nobody is viewing).
 */
export async function saveCollection(
  key: string,
  data: unknown,
  options: { overwrite?: boolean; reload?: boolean } = {}
) {
  const baseRevision = options.overwrite ? null : dataStore.getSnapshot(key).revision;
  try {
    return await dataStore.mutate(() => api.saveData(key, data, baseRevision), {
      reload: options.reload === false ? [] : [key],
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) await dataStore.load(key);
    throw error;
  }
}

/** Save only what changed between two versions of a list of records with ids. */
export async function saveRecordChanges<T extends { id: string }>(key: RecordKey, before: T[], after: T[]) {
  const changes = diffRecords(before, after);
  if (changes.upsert.length === 0 && changes.remove.length === 0) return;
  await dataStore.mutate(() => api.applyRecordChanges(key, changes), { reload: [key] });
}

/** Save the bin/quantity changes between two versions of the bin list (absolute quantities). */
export async function saveBinChanges(before: BinLocation[], after: BinLocation[]) {
  const changes = diffBins(before, after);
  if (changes.newBins.length === 0 && changes.changes.length === 0) return;
  await dataStore.mutate(() => api.setBinQuantities(changes), { reload: ["rf_bins"] });
}
