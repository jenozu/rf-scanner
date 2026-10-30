import { describe, it, expect } from "vitest";
import { planMigration, readBrowserCollections, sizeOf } from "./migration";

const fakeStorage = (values: Record<string, string>) => ({ getItem: (k: string) => values[k] ?? null });

describe("readBrowserCollections", () => {
  it("returns only non-empty, correctly shaped warehouse collections", () => {
    const storage = fakeStorage({
      rf_bins: JSON.stringify([{ BinCode: "A" }]),
      rf_orders: "[]",
      rf_waves: "not json",
      rf_master_meta: JSON.stringify({ sourceFile: "m.xlsx" }),
      rf_purchase_orders: JSON.stringify({ not: "a list" }),
      rf_app_settings: JSON.stringify({ theme: "light" }),
      rf_users: JSON.stringify([{ id: 1 }]),
    });
    expect(readBrowserCollections(storage)).toEqual({
      rf_bins: [{ BinCode: "A" }],
      rf_master_meta: { sourceFile: "m.xlsx" },
    });
  });

  it("treats a meta list or a null value as nothing to move", () => {
    const storage = fakeStorage({ rf_master_meta: "[1]", rf_bins: "null" });
    expect(readBrowserCollections(storage)).toEqual({});
  });
});

describe("planMigration", () => {
  it("marks collections the server does not have yet as upload and the others as conflict", () => {
    const browser = { rf_bins: [1, 2, 3], rf_purchase_orders: [1], rf_master_meta: { a: 1 } };
    const rows = planMigration(browser, { rf_bins: 40, rf_purchase_orders: 0 });
    expect(rows).toEqual([
      { key: "rf_bins", label: "Bins and stock", browserCount: 3, serverCount: 40, action: "conflict" },
      { key: "rf_purchase_orders", label: "Purchase orders (with receiving progress)", browserCount: 1, serverCount: 0, action: "upload" },
      { key: "rf_master_meta", label: "Master inventory details", browserCount: 1, serverCount: 0, action: "upload" },
    ]);
  });

  it("has no rows for a device with nothing to move", () => {
    expect(planMigration({}, { rf_bins: 5 })).toEqual([]);
  });
});

describe("sizeOf", () => {
  it("counts lists and objects and treats everything else as 0", () => {
    expect([sizeOf([1, 2]), sizeOf({ a: 1 }), sizeOf(null), sizeOf("x"), sizeOf(undefined)]).toEqual([2, 1, 0, 0, 0]);
  });
});
