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
const bcrypt = createRequire(path.join(process.cwd(), "server", "package.json"))("bcryptjs") as typeof import("bcryptjs");

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
});
