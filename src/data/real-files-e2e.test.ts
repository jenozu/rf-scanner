// End-to-end check with the user's REAL SAP exports and the REAL API server (throwaway data
// folder, nothing committed, nothing touches production). Skipped unless both files are given:
//
//   RF_REAL_PO_XLSX=/path/po.xlsx RF_REAL_SO_XLSX=/path/so.xlsx npx vitest run src/data/real-files-e2e.test.ts
//
// Why it exists: the master-import bug passed every test built from local snapshots and only
// showed up on the real file. This runs the exact pipeline the Setup page runs (read the file,
// post to /api/imports/orders) against the exact files SAP produced.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { importPurchaseOrderFile, importSalesOrderFile } from "./sap-import";
// @ts-expect-error plain JS helper from the server's own test kit
import { startTestServer } from "../../server/testing/helpers.js";

// bcryptjs is a dependency of the server, not of the app: load it from the server's own node_modules.
const bcrypt = createRequire(path.join(process.cwd(), "server", "package.json"))("bcryptjs") as { hash(value: string, rounds: number): Promise<string> };

const poPath = process.env.RF_REAL_PO_XLSX;
const soPath = process.env.RF_REAL_SO_XLSX;

describe.skipIf(!poPath || !soPath)("real SAP exports through the real API", () => {
  let srv: { base: string; dataDir: string; close: () => Promise<void> };
  let token = "";
  const file = (p: string, name: string) => new File([fs.readFileSync(p)], name);
  const read = (key: string) => JSON.parse(fs.readFileSync(path.join(srv.dataDir, `${key}.json`), "utf8"));
  const post = async (url: string, body: unknown) => {
    const res = await fetch(`${srv.base}${url}`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    srv = await startTestServer();
    const passwordHash = await bcrypt.hash("operator-pass-1", 4);
    fs.writeFileSync(path.join(srv.dataDir, "users.json"), JSON.stringify([
      { id: "u1", username: "op", passwordHash, fullName: "op", role: "operator", isActive: true },
    ]));
    const login = await fetch(`${srv.base}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "op", password: "operator-pass-1" }),
    });
    token = (await login.json()).token;
  });
  afterAll(async () => { await srv?.close(); });

  it("imports the real PO file: 76 orders / 267 lines, then the same file again changes nothing", async () => {
    const { orders } = await importPurchaseOrderFile(file(poPath!, "po.xlsx"));
    const first = await post("/api/imports/orders", { kind: "po", orders });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ added: 76, updated: 0, unchanged: 0 });
    const stored1 = fs.readFileSync(path.join(srv.dataDir, "rf_purchase_orders.json"), "utf8");
    expect(read("rf_purchase_orders").reduce((n: number, o: any) => n + o.items.length, 0)).toBe(267);

    const second = await post("/api/imports/orders", { kind: "po", orders });
    expect(second.body).toMatchObject({ added: 0, updated: 0, unchanged: 76 });
    expect(fs.readFileSync(path.join(srv.dataDir, "rf_purchase_orders.json"), "utf8")).toBe(stored1);
  });

  it("imports the real SO file from 6 devices at once: 154 orders / 417 lines, each exactly once", async () => {
    const { orders } = await importSalesOrderFile(file(soPath!, "so.xlsx"));
    const results = await Promise.all(Array.from({ length: 6 }, () => post("/api/imports/orders", { kind: "so", orders })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.reduce((n, r) => n + r.body.added, 0)).toBe(154);
    const stored = read("rf_sales_orders");
    expect(stored.length).toBe(154);
    expect(new Set(stored.map((o: any) => o.id)).size).toBe(154);
    expect(stored.reduce((n: number, o: any) => n + o.items.length, 0)).toBe(417);
    expect(new Set(stored.flatMap((o: any) => o.items.map((i: any) => i.LineKey))).size).toBe(417);
  });

  it("an SO line picked in the app survives re-importing the real file", async () => {
    const sos = read("rf_sales_orders");
    const target = sos.find((s: any) => s.items.length > 1 && s.items.every((i: any) => i.DeliveredQty === 0));
    target.items[1].DeliveredQty = 1;
    target.items[1].RemainingQty = target.items[1].OrderedQty - 1;
    target.status = "picking"; // what a real pick sets
    fs.writeFileSync(path.join(srv.dataDir, "rf_sales_orders.json"), JSON.stringify(sos));
    const { orders } = await importSalesOrderFile(file(soPath!, "so.xlsx"));
    const res = await post("/api/imports/orders", { kind: "so", orders });
    expect(res.body).toMatchObject({ added: 0, updated: 0, unchanged: 154 });
    const after = read("rf_sales_orders").find((s: any) => s.id === target.id);
    expect(after.items[1].DeliveredQty).toBe(1);
  });

  // ---- Phase 4 on the real orders: lines are addressed by key, quantities are capped, pickers don't collide ----

  const duplicates = (orders: any[]) => {
    for (const order of orders) {
      const byItem = new Map<string, any[]>();
      for (const line of order.items) byItem.set(line.ItemCode, [...(byItem.get(line.ItemCode) ?? []), line]);
      const lines = [...byItem.values()].find((group) => group.length > 1 && group.every((l) => !l.SapClosed && l.OrderedQty >= 2));
      if (lines) return { order, lines };
    }
    return undefined;
  };

  // (The real PO export has no order with the same ItemCode on two lines, so that case is covered by
  // the synthetic tests in server/test/line-ops.test.js; here the real lines show caps and addressing.)
  it("receiving a real PO line touches only that line, and the cap holds", async () => {
    const pos = read("rf_purchase_orders");
    const order = pos.find((p: any) => p.items.length > 2 && p.items.some((l: any) => l.OrderedQty >= 2 && !l.SapClosed));
    expect(order).toBeDefined();
    const target = order.items.find((l: any) => l.OrderedQty >= 2 && !l.SapClosed);
    const ok = await post("/api/ops/receive", { poId: order.id, lineKey: target.LineKey, qty: 1, binCode: "E2E-BIN-1", txnId: "E2E-R1" });
    expect(ok.status).toBe(200);
    const after = read("rf_purchase_orders").find((p: any) => p.id === order.id);
    for (const line of after.items) {
      const before = order.items.find((l: any) => l.LineKey === line.LineKey);
      expect(line.ReceivedQty).toBe((before.ReceivedQty || 0) + (line.LineKey === target.LineKey ? 1 : 0));
    }
    const over = await post("/api/ops/receive", { poId: order.id, lineKey: target.LineKey, qty: target.OrderedQty, binCode: "E2E-BIN-1", txnId: "E2E-R2" });
    expect(over.status).toBe(409);
    expect(over.body.code).toBe("OVER_RECEIPT");
  });

  it("picking real SO lines: same-item lines are separate, over-pick is refused, two pickers both land", async () => {
    const found = duplicates(read("rf_sales_orders"));
    expect(found, "the real SO file has an order with the same ItemCode on two lines").toBeDefined();
    const { order, lines } = found!;
    const [first, second] = lines;
    fs.writeFileSync(path.join(srv.dataDir, "rf_bins.json"), JSON.stringify([
      { BinCode: "E2E-BIN-1", Zone: "Z", Capacity: 100000, Status: "active", Items: [{ ItemCode: first.ItemCode, Description: "x", Quantity: 100000 }] },
    ]));
    for (const line of [first, second]) {
      const assigned = await post("/api/ops/so-assign-bin", { soId: order.id, lineKey: line.LineKey, binCode: "E2E-BIN-1" });
      expect(assigned.status).toBe(200);
    }
    const pickBody = (line: any, qty: number, txnId: string) =>
      ({ soId: order.id, lineKey: line.LineKey, qty, txnId, scannedCode: line.ItemCode });

    const wrong = await post("/api/ops/pick-so", { ...pickBody(first, 1, "E2E-P0"), scannedCode: "NOT-THE-ITEM" });
    expect(wrong.body.code).toBe("SCAN_MISMATCH");
    const over = await post("/api/ops/pick-so", pickBody(first, first.OrderedQty + 1, "E2E-P1"));
    expect(over.status).toBe(409);
    expect(over.body.code).toBe("OVER_PICK");

    const [a, b] = await Promise.all([
      post("/api/ops/pick-so", pickBody(first, 1, "E2E-P2")),
      post("/api/ops/pick-so", pickBody(second, 1, "E2E-P3")),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const after = read("rf_sales_orders").find((s: any) => s.id === order.id);
    expect(after.items.find((l: any) => l.LineKey === first.LineKey).DeliveredQty).toBe((first.DeliveredQty || 0) + 1);
    expect(after.items.find((l: any) => l.LineKey === second.LineKey).DeliveredQty).toBe((second.DeliveredQty || 0) + 1);
    expect(read("rf_pick_txns").length).toBe(2);

    // Re-importing the real file afterwards keeps both picks.
    const { orders } = await importSalesOrderFile(file(soPath!, "so.xlsx"));
    await post("/api/imports/orders", { kind: "so", orders });
    const again = read("rf_sales_orders").find((s: any) => s.id === order.id);
    expect(again.items.find((l: any) => l.LineKey === first.LineKey).DeliveredQty).toBe((first.DeliveredQty || 0) + 1);
  });
});
