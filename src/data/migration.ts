/**
 * Moving a device's old browser-stored warehouse data to the server (one time).
 * These are the pure parts: reading what the browser holds and deciding what each
 * collection would do. The Settings card (components/migration-card.tsx) shows the
 * plan and calls the admin-only server route.
 */

export const MIGRATION_LABELS: Record<string, string> = {
  rf_active: "Active inventory",
  rf_master: "Master inventory",
  rf_master_meta: "Master inventory details",
  rf_bins: "Bins and stock",
  rf_purchase_orders: "Purchase orders (with receiving progress)",
  rf_sales_orders: "Sales orders (with picking progress)",
  rf_orders: "Wave orders",
  rf_waves: "Waves",
  rf_cycle_counts: "Cycle counts",
  rf_cycle_count_txns: "Cycle count log",
  rf_receiving_txns: "Receiving log",
  rf_inventory_sessions: "Counting sessions",
  rf_session_count_logs: "Session count log",
  rf_temporary_locations: "Temporary locations",
};

export const MIGRATION_KEYS = Object.keys(MIGRATION_LABELS);

/** Items in a list, or entries in an object; 0 for anything else. */
export function sizeOf(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object") return Object.keys(value).length;
  return 0;
}

/** Everything this browser holds for the migratable keys (skips missing, broken and empty ones). */
export function readBrowserCollections(storage: Pick<Storage, "getItem">): Record<string, unknown> {
  const found: Record<string, unknown> = {};
  for (const key of MIGRATION_KEYS) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const wantsObject = key === "rf_master_meta";
      const rightShape = wantsObject
        ? parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        : Array.isArray(parsed);
      if (rightShape && sizeOf(parsed) > 0) found[key] = parsed;
    } catch {
      // unreadable value: ignore it
    }
  }
  return found;
}

export type MigrationAction = "upload" | "conflict";

export interface MigrationRow {
  key: string;
  label: string;
  browserCount: number;
  serverCount: number;
  /** upload: the server copy is empty. conflict: the server already has data. */
  action: MigrationAction;
}

/** One row per collection this device has data for. */
export function planMigration(
  browser: Record<string, unknown>,
  serverCounts: Record<string, number>
): MigrationRow[] {
  return Object.keys(browser).map((key) => {
    const serverCount = serverCounts[key] ?? 0;
    return {
      key,
      label: MIGRATION_LABELS[key] ?? key,
      browserCount: sizeOf(browser[key]),
      serverCount,
      action: serverCount === 0 ? "upload" : "conflict",
    };
  });
}
