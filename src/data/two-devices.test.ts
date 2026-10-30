/**
 * Two "handhelds" (two independent client stores) talking to the real API
 * (server/index.js on a throwaway data folder). Proves the goal of Phase 2:
 * work saved on one device shows up on the other, and simultaneous work adds up.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

let server: import("node:http").Server;
let dataDir: string;
let api: typeof import("../services/api").api;
let deviceA: typeof import("./hooks").dataStore; // the app's own store
let deviceB: import("./store").DataStore;        // a second device
let ops: typeof import("./ops");
let DataStoreClass: typeof import("./store").DataStore;

const bins = (store: { getSnapshot: (k: string) => any }) => store.getSnapshot("rf_bins").data as any[];
const po = (store: { getSnapshot: (k: string) => any }) => store.getSnapshot("rf_purchase_orders").data[0];

beforeAll(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "rf-two-devices-"));
  process.env.NODE_ENV = "test";
  process.env.DATA_DIR = dataDir;
  process.env.JWT_SECRET = "two-devices-secret-two-devices-secret-12345";
  await fs.writeFile(path.join(dataDir, "users.json"), JSON.stringify([
    { id: "u1", username: "picker", password: "picker-password-1", fullName: "Picker", role: "operator", isActive: true },
  ]));

  // @ts-expect-error the server is plain JavaScript without type declarations
  const { default: app } = await import("../../server/index.js");
  server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const port = (server.address() as AddressInfo).port;

  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => session.get(k) ?? null,
    setItem: (k: string, v: string) => void session.set(k, v),
    removeItem: (k: string) => void session.delete(k),
  });
  vi.stubEnv("VITE_API_URL", `http://127.0.0.1:${port}/api`);
  vi.stubEnv("VITE_DEMO_MODE", "false");

  ({ api } = await import("../services/api"));
  ({ dataStore: deviceA } = await import("./hooks"));
  DataStoreClass = (await import("./store")).DataStore;
  ops = await import("./ops");
  deviceB = new DataStoreClass(api);

  await api.login("picker", "picker-password-1");
  await api.saveData("rf_purchase_orders", [{
    id: "po1", poNumber: "5001", vendor: "V", status: "pending", expectedDate: "2026-01-01",
    items: [
      { LineNumber: 1, ItemCode: "A", Description: "Widget", OrderedQty: 100, ReceivedQty: 0 },
      { LineNumber: 2, ItemCode: "A", Description: "Widget", OrderedQty: 100, ReceivedQty: 0 },
    ],
  }]);
  await api.saveData("rf_bins", []);
  await api.saveData("rf_sales_orders", [{
    id: "so1", soNumber: "7", status: "pending",
    items: [{ ItemCode: "A", OrderedQty: 10, DeliveredQty: 0, RemainingQty: 10, BinCode: "DOCK" }],
  }]);
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await fs.rm(dataDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("two devices, one server", () => {
  it("a receipt made on device A shows on device B after it refreshes", async () => {
    const releaseA = [deviceA.retain("rf_purchase_orders"), deviceA.retain("rf_bins")];
    const releaseB = [deviceB.retain("rf_purchase_orders"), deviceB.retain("rf_bins")];
    await Promise.all([deviceA.load("rf_purchase_orders"), deviceB.load("rf_purchase_orders"), deviceA.load("rf_bins"), deviceB.load("rf_bins")]);
    expect(po(deviceB).items[1].ReceivedQty).toBe(0);

    await ops.receiveStock({ poId: "po1", lineIndex: 1, qty: 10, binCode: "DOCK", txnId: "RCV-A1" });

    // Device A already sees it (mutate reloads); B sees it after its next refresh.
    expect(po(deviceA).items[1].ReceivedQty).toBe(10);
    expect(po(deviceB).items[1].ReceivedQty).toBe(0);
    await deviceB.refreshVisible();
    expect(po(deviceB).items[1].ReceivedQty).toBe(10);
    expect(po(deviceB).items[0].ReceivedQty).toBe(0); // the same-ItemCode line is untouched
    expect(bins(deviceB)[0].Items[0].Quantity).toBe(10);

    [...releaseA, ...releaseB].forEach((release) => release());
  });

  it("both devices receiving at the same moment add up instead of overwriting", async () => {
    const releases = [deviceA.retain("rf_bins"), deviceB.retain("rf_bins")];
    await Promise.all([deviceA.load("rf_bins"), deviceB.load("rf_bins")]);
    await Promise.all(Array.from({ length: 10 }, (_, i) =>
      i % 2
        ? ops.receiveStock({ poId: "po1", lineIndex: 0, qty: 3, binCode: "DOCK", txnId: `RCV-C${i}` })
        : deviceB.mutate(() => api.receiveStock({ poId: "po1", lineIndex: 0, qty: 3, binCode: "DOCK", txnId: `RCV-C${i}` }),
            { reload: ["rf_purchase_orders", "rf_bins"] })));
    await Promise.all([deviceA.load("rf_bins"), deviceB.load("rf_bins")]);
    expect(bins(deviceA)[0].Items[0].Quantity).toBe(10 + 30);
    expect(bins(deviceB)[0].Items[0].Quantity).toBe(10 + 30);
    expect((await api.getData("rf_receiving_txns")).length).toBe(11);
    releases.forEach((release) => release());
  });

  it("a retried receipt (same transaction id) is not applied twice", async () => {
    const again = await ops.receiveStock({ poId: "po1", lineIndex: 1, qty: 10, binCode: "DOCK", txnId: "RCV-A1" });
    expect(again.duplicate).toBe(true);
    const bin = (await api.getData("rf_bins"))[0];
    expect(bin.Items[0].Quantity).toBe(40);
  });

  it("a pick on device B reduces the stock device A sees", async () => {
    const release = deviceA.retain("rf_bins");
    await deviceA.load("rf_bins");
    await deviceB.mutate(() => api.pickSalesOrderLine({ soId: "so1", lineIndex: 0, qty: 4 }), { reload: ["rf_bins"] });
    await deviceA.refreshVisible();
    expect(bins(deviceA)[0].Items[0].Quantity).toBe(36);
    release();
  });

  it("a failed save is reported, not hidden", async () => {
    await expect(ops.receiveStock({ poId: "missing", lineIndex: 0, qty: 1, binCode: "DOCK", txnId: "RCV-BAD" }))
      .rejects.toThrow(/not found/i);
    expect(deviceA.getStatus().saveError).toMatch(/not found/i);
    expect(deviceA.getStatus().pending).toBe(0);
  });

  it("nothing is kept in browser storage (clearing it cannot lose data)", async () => {
    // These tests never defined localStorage at all; the server has everything.
    expect((globalThis as any).localStorage).toBeUndefined();
    const txns = await api.getData("rf_receiving_txns");
    expect(txns.length).toBe(11);
  });

  it("two devices counting different bins at the same time both keep their counts", async () => {
    await api.saveData("rf_bins", Array.from({ length: 6 }, (_, i) => ({
      BinCode: `CNT-${i}`, Zone: "Z", Capacity: 10, Status: "active",
      Items: [{ ItemCode: "A", Description: "Widget", Quantity: 10 }],
    })));
    await Promise.all([deviceA.load("rf_bins"), deviceB.load("rf_bins")]);

    // Each device counts three bins, using the same helpers the Inventory page uses.
    const countOn = (store: { getSnapshot: (k: string) => any }, codes: string[], qty: number) => {
      const before = bins(store);
      const after = before.map((b: any) => codes.includes(b.BinCode)
        ? { ...b, Items: b.Items.map((i: any) => ({ ...i, Quantity: qty })) } : b);
      return [before, after] as const;
    };
    const [beforeA, afterA] = countOn(deviceA, ["CNT-0", "CNT-1", "CNT-2"], 3);
    const [beforeB, afterB] = countOn(deviceB, ["CNT-3", "CNT-4", "CNT-5"], 7);
    await Promise.all([ops.saveBinChanges(beforeA, afterA), ops.saveBinChanges(beforeB, afterB)]);

    const saved = await api.getData("rf_bins");
    expect(saved.map((b: any) => b.Items[0].Quantity)).toEqual([3, 3, 3, 7, 7, 7]);
  });

  it("two devices saving different counting sessions at the same time both land", async () => {
    await api.saveData("rf_inventory_sessions", []);
    await Promise.all([deviceA.load("rf_inventory_sessions"), deviceB.load("rf_inventory_sessions")]);
    const beforeA = deviceA.getSnapshot("rf_inventory_sessions").data as any[];
    const beforeB = deviceB.getSnapshot("rf_inventory_sessions").data as any[];
    await Promise.all([
      ops.saveRecordChanges("rf_inventory_sessions", beforeA, [...beforeA, { id: "sess-A", name: "Aisle 1" }]),
      ops.saveRecordChanges("rf_inventory_sessions", beforeB, [...beforeB, { id: "sess-B", name: "Aisle 2" }]),
    ]);
    const saved = await api.getData("rf_inventory_sessions");
    expect(saved.map((x: any) => x.id).sort()).toEqual(["sess-A", "sess-B"]);
  });
});
