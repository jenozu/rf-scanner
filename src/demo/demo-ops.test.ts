import { describe, it, expect, beforeEach, vi } from "vitest";

// The demo backend runs in the browser; give it a tiny in-memory localStorage.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubEnv("VITE_DEMO_MODE", "true");

import { demoRequest } from "./demo-mode";

const post = (endpoint: string, body: unknown, method = "POST") =>
  demoRequest<any>(endpoint, { method, body: JSON.stringify(body) });

beforeEach(() => {
  store.clear();
  store.set("rf_bins", JSON.stringify([{ BinCode: "A", Zone: "Z", Capacity: 10, Status: "active", Items: [] }]));
});

describe("demo backend operations (shared logic with the server)", () => {
  it("adjusts bins and refuses to go negative", async () => {
    await post("/ops/bin-adjust", { binCode: "A", itemCode: "X", delta: 5 });
    expect(JSON.parse(store.get("rf_bins")!)[0].Items[0].Quantity).toBe(5);
    await expect(post("/ops/bin-adjust", { binCode: "A", itemCode: "X", delta: -6 })).rejects.toThrow("Insufficient");
    expect(JSON.parse(store.get("rf_bins")!)[0].Items[0].Quantity).toBe(5);
  });

  it("appends transactions idempotently", async () => {
    await post("/ops/append", { key: "rf_receiving_txns", record: { id: "r1" } });
    const again = await post("/ops/append", { key: "rf_receiving_txns", record: { id: "r1" } });
    expect(again.added).toBe(0);
    expect(JSON.parse(store.get("rf_receiving_txns")!)).toHaveLength(1);
  });

  it("receives against one PO line by position", async () => {
    store.set("rf_purchase_orders", JSON.stringify([{ id: "p", items: [
      { ItemCode: "A", OrderedQty: 5, ReceivedQty: 0 }, { ItemCode: "A", OrderedQty: 5, ReceivedQty: 0 },
    ] }]));
    const res = await post("/ops/po-receive", { poId: "p", lineIndex: 1, qty: 2 });
    expect(res.po.items.map((i: any) => i.ReceivedQty)).toEqual([0, 2]);
  });

  it("upserts and deletes records", async () => {
    await post("/records/rf_waves/w1", { record: { id: "w1" } }, "PUT");
    await post("/records/rf_waves/upsert-many", { records: [{ id: "w2" }] });
    expect(JSON.parse(store.get("rf_waves")!)).toHaveLength(2);
    await demoRequest("/records/rf_waves/w1", { method: "DELETE" });
    expect(JSON.parse(store.get("rf_waves")!).map((w: any) => w.id)).toEqual(["w2"]);
    await expect(post("/records/rf_bins/x", { record: { id: "x" } }, "PUT")).rejects.toThrow("Invalid key");
  });

  it("receives stock across PO, bin and log in one call, and ignores a repeated txnId", async () => {
    store.set("rf_purchase_orders", JSON.stringify([{ id: "p", poNumber: "7", items: [
      { ItemCode: "A", Description: "a", OrderedQty: 5, ReceivedQty: 0 },
    ] }]));
    const body = { poId: "p", lineIndex: 0, qty: 3, binCode: "A", txnId: "RCV-1" };
    await post("/ops/receive", body);
    const again = await post("/ops/receive", body);
    expect(again.duplicate).toBe(true);
    expect(JSON.parse(store.get("rf_purchase_orders")!)[0].items[0].ReceivedQty).toBe(3);
    expect(JSON.parse(store.get("rf_bins")!)[0].Items[0].Quantity).toBe(3);
    expect(JSON.parse(store.get("rf_receiving_txns")!)).toHaveLength(1);
  });

  it("picks a sales-order line and takes the stock from the bin", async () => {
    store.set("rf_bins", JSON.stringify([{ BinCode: "A", Zone: "Z", Capacity: 10, Status: "active",
      Items: [{ ItemCode: "X", Description: "x", Quantity: 5 }] }]));
    store.set("rf_sales_orders", JSON.stringify([{ id: "s", items: [
      { ItemCode: "X", OrderedQty: 2, DeliveredQty: 0, RemainingQty: 2, BinCode: "A" },
    ] }]));
    const res = await post("/ops/pick-so", { soId: "s", lineIndex: 0, qty: 2 });
    expect(res.so.status).toBe("picked");
    expect(JSON.parse(store.get("rf_bins")!)[0].Items[0].Quantity).toBe(3);
  });
});
