import {
  ActivityLog,
  AppSettings,
  BinLocation,
  CycleCount,
  CycleCountTransaction,
  InventorySession,
  Item,
  PurchaseOrder,
  ReceivingTransaction,
  SalesOrder,
  TemporaryLocation,
  User,
  Wave,
} from "../types";
import * as ops from "../../server/ops-logic.js";

const DEMO_VERSION = "premium-wms-v1";

export const demoUser: User = {
  id: "demo-admin",
  username: "demo",
  password: "demo",
  fullName: "Preview Operator",
  role: "admin",
  isActive: true,
  createdDate: "2026-10-01T12:00:00.000Z",
  lastLogin: "2026-10-16T18:30:00.000Z",
};

const demoItems: Item[] = [
  { BinCode: "01-0102", ItemCode: "PTO-850-A", Description: "Heavy-duty power take-off assembly", ExpectedQty: 12, CountedQty: 12, Variance: 0 },
  { BinCode: "01-0104", ItemCode: "GBX-220", Description: "Industrial reduction gearbox", ExpectedQty: 8, CountedQty: 8, Variance: 0 },
  { BinCode: "01-0210", ItemCode: "FLT-100", Description: "Spin-on fuel filter", ExpectedQty: 46, CountedQty: 46, Variance: 0 },
  { BinCode: "01-0214", ItemCode: "SNS-440", Description: "Pressure sensor", ExpectedQty: 24, CountedQty: 24, Variance: 0 },
  { BinCode: "01-0311", ItemCode: "UJT-330", Description: "Universal joint kit", ExpectedQty: 30, CountedQty: 30, Variance: 0 },
  { BinCode: "01-0416", ItemCode: "CLT-510", Description: "Industrial clutch plate", ExpectedQty: 18, CountedQty: 18, Variance: 0 },
  { BinCode: "01-0510", ItemCode: "CTRL-700", Description: "Electronic control module", ExpectedQty: 5, CountedQty: 5, Variance: 0 },
];

const demoBins: BinLocation[] = demoItems.map((item, index) => ({
  BinCode: item.BinCode,
  Zone: index < 2 ? "Heavy Components" : index < 5 ? "Fast Pick" : "Controlled",
  Capacity: index < 2 ? 40 : 120,
  Status: "active",
  Items: [{
    ItemCode: item.ItemCode,
    Description: item.Description,
    Quantity: item.ExpectedQty,
  }],
}));

const demoPurchaseOrders: PurchaseOrder[] = [
  {
    id: "demo-po-1",
    poNumber: "PO-48217",
    vendor: "Atlas Power Components",
    cardCode: "V-DEMO-01",
    status: "receiving",
    expectedDate: "2026-10-16",
    items: [
      { LineNumber: 0, ItemCode: "PTO-850-A", Description: "Heavy-duty power take-off assembly", OrderedQty: 6, ReceivedQty: 4, RemainingQty: 2, BinCode: "01-0102" },
      { LineNumber: 1, ItemCode: "FLT-100", Description: "Spin-on fuel filter", OrderedQty: 24, ReceivedQty: 24, RemainingQty: 0, BinCode: "01-0210" },
    ],
  },
  {
    id: "demo-po-2",
    poNumber: "PO-48231",
    vendor: "Northline Motion Supply",
    cardCode: "V-DEMO-02",
    status: "pending",
    expectedDate: "2026-10-17",
    items: [
      { LineNumber: 0, ItemCode: "GBX-220", Description: "Industrial reduction gearbox", OrderedQty: 3, ReceivedQty: 0, RemainingQty: 3, BinCode: "01-0104" },
      { LineNumber: 1, ItemCode: "UJT-330", Description: "Universal joint kit", OrderedQty: 12, ReceivedQty: 0, RemainingQty: 12, BinCode: "01-0311" },
    ],
  },
  {
    id: "demo-po-3",
    poNumber: "PO-48244",
    vendor: "Vector Controls",
    cardCode: "V-DEMO-03",
    status: "pending",
    expectedDate: "2026-10-20",
    items: [
      { LineNumber: 0, ItemCode: "CTRL-700", Description: "Electronic control module", OrderedQty: 4, ReceivedQty: 0, RemainingQty: 4, BinCode: "01-0510", RequiresLotSerial: true },
    ],
  },
];

const demoSalesOrders: SalesOrder[] = [
  {
    id: "demo-so-1",
    soNumber: "SO-73104",
    customer: "Northern Lift Systems",
    cardCode: "C-DEMO-01",
    status: "picked",
    createdDate: "2026-10-16T12:15:00.000Z",
    shipToStreet: "125 Industrial Way",
    shipToCity: "Hamilton",
    shipToProvince: "ON",
    shipToPostal: "L8N 3Y1",
    shipToCountry: "CA",
    shipToPhone: "905-555-0130",
    items: [
      { LineNumber: 0, ItemCode: "PTO-850-A", Description: "Heavy-duty power take-off assembly", OrderedQty: 1, DeliveredQty: 1, RemainingQty: 0, BinCode: "01-0102" },
      { LineNumber: 1, ItemCode: "FLT-100", Description: "Spin-on fuel filter", OrderedQty: 4, DeliveredQty: 4, RemainingQty: 0, BinCode: "01-0210" },
    ],
  },
  {
    id: "demo-so-2",
    soNumber: "SO-73111",
    customer: "Bluewater Marine Service",
    cardCode: "C-DEMO-02",
    status: "picking",
    createdDate: "2026-10-16T13:05:00.000Z",
    shipToStreet: "42 Harbour Road",
    shipToCity: "Kingston",
    shipToProvince: "ON",
    shipToPostal: "K7K 5W1",
    shipToCountry: "CA",
    shipToPhone: "613-555-0174",
    items: [
      { LineNumber: 0, ItemCode: "GBX-220", Description: "Industrial reduction gearbox", OrderedQty: 1, DeliveredQty: 0, RemainingQty: 1, BinCode: "01-0104" },
      { LineNumber: 1, ItemCode: "SNS-440", Description: "Pressure sensor", OrderedQty: 2, DeliveredQty: 1, RemainingQty: 1, BinCode: "01-0214" },
    ],
  },
  {
    id: "demo-so-3",
    soNumber: "SO-73118",
    customer: "Prairie Aggregate Works",
    cardCode: "C-DEMO-03",
    status: "pending",
    createdDate: "2026-10-16T14:25:00.000Z",
    shipToStreet: "815 Quarry Drive",
    shipToCity: "Winnipeg",
    shipToProvince: "MB",
    shipToPostal: "R2C 3A8",
    shipToCountry: "CA",
    shipToPhone: "204-555-0112",
    items: [
      { LineNumber: 0, ItemCode: "UJT-330", Description: "Universal joint kit", OrderedQty: 3, DeliveredQty: 0, RemainingQty: 3, BinCode: "01-0311" },
    ],
  },
  {
    id: "demo-so-4",
    soNumber: "SO-73092",
    customer: "Summit Equipment Group",
    cardCode: "C-DEMO-04",
    status: "shipped",
    createdDate: "2026-10-15T16:10:00.000Z",
    shippedDate: "2026-10-16T13:42:00.000Z",
    shipmentPin: "DEMO-64019382",
    items: [
      { LineNumber: 0, ItemCode: "CLT-510", Description: "Industrial clutch plate", OrderedQty: 2, DeliveredQty: 2, RemainingQty: 0, BinCode: "01-0416" },
    ],
  },
];

const demoCounts: CycleCount[] = [
  { id: "demo-cc-1", BinCode: "01-0210", ItemCode: "FLT-100", ExpectedQty: 46, CountedQty: 46, Variance: 0, CountDate: "2026-10-16T12:30:00.000Z", Status: "completed" },
  { id: "demo-cc-2", BinCode: "01-0311", ItemCode: "UJT-330", ExpectedQty: 30, CountedQty: 28, Variance: -2, CountDate: "2026-10-16T13:10:00.000Z", Status: "completed" },
  { id: "demo-cc-3", BinCode: "01-0416", ItemCode: "CLT-510", ExpectedQty: 18, Status: "pending" },
  { id: "demo-cc-4", BinCode: "01-0510", ItemCode: "CTRL-700", ExpectedQty: 5, Status: "pending" },
  { id: "demo-cc-5", BinCode: "01-0214", ItemCode: "SNS-440", ExpectedQty: 24, Status: "pending" },
];

const demoWaves: Wave[] = [
  { id: "demo-wave-1", waveNumber: "WAVE-104", orders: [], status: "active", createdDate: "2026-10-16T13:00:00.000Z" },
];

const demoReceivingTransactions: ReceivingTransaction[] = [
  { id: "demo-rcv-1", poNumber: "PO-48217", itemCode: "FLT-100", description: "Spin-on fuel filter", qty: 24, binCode: "01-0210", timestamp: "2026-10-16T12:22:00.000Z" },
  { id: "demo-rcv-2", poNumber: "PO-48217", itemCode: "PTO-850-A", description: "Heavy-duty power take-off assembly", qty: 4, binCode: "01-0102", timestamp: "2026-10-16T12:08:00.000Z" },
];

const demoCountTransactions: CycleCountTransaction[] = [
  { id: "demo-cct-1", binCode: "01-0210", itemCode: "FLT-100", description: "Spin-on fuel filter", expectedQty: 46, countedQty: 46, variance: 0, timestamp: "2026-10-16T12:30:00.000Z" },
  { id: "demo-cct-2", binCode: "01-0311", itemCode: "UJT-330", description: "Universal joint kit", expectedQty: 30, countedQty: 28, variance: -2, timestamp: "2026-10-16T13:10:00.000Z" },
];

const demoActivity: ActivityLog[] = [
  { id: "demo-log-1", userId: demoUser.id, username: demoUser.username, action: "Shipment confirmed", timestamp: "2026-10-16T13:42:00.000Z", details: "SO-73092 · demo carrier transaction" },
  { id: "demo-log-2", userId: demoUser.id, username: demoUser.username, action: "Cycle count completed", timestamp: "2026-10-16T13:10:00.000Z", details: "01-0311 · variance -2" },
  { id: "demo-log-3", userId: demoUser.id, username: demoUser.username, action: "Receiving posted", timestamp: "2026-10-16T12:22:00.000Z", details: "PO-48217 · 24 units" },
];

const demoSessions: InventorySession[] = [
  {
    id: "demo-session-1",
    name: "Fast-pick verification",
    createdDate: "2026-10-16T12:00:00.000Z",
    lastAccessedDate: "2026-10-16T13:10:00.000Z",
    status: "active",
    cycleCountIds: demoCounts.map((c) => c.id),
    currentCycleCountId: "demo-cc-3",
    countingMode: "cycle",
  },
];

const demoTemporaryLocations: TemporaryLocation[] = [];

const demoSettings: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  autoLogout: false,
  autoLogoutMinutes: 15,
  showActivityLog: true,
  theme: "light",
};

const demoData: Record<string, unknown> = {
  rf_master: demoItems,
  rf_active: demoItems,
  rf_bins: demoBins,
  rf_purchase_orders: demoPurchaseOrders,
  rf_orders: [],
  rf_sales_orders: demoSalesOrders,
  rf_waves: demoWaves,
  rf_cycle_counts: demoCounts,
  rf_receiving_txns: demoReceivingTransactions,
  rf_cycle_count_txns: demoCountTransactions,
  rf_activity_logs: demoActivity,
  rf_inventory_sessions: demoSessions,
  rf_temporary_locations: demoTemporaryLocations,
  rf_session_count_logs: [],
  rf_master_meta: {
    updatedAt: "2026-10-16T11:45:00.000Z",
    updatedBy: "preview",
    sourceFile: "synthetic-preview-inventory.csv",
    itemCount: demoItems.length,
  },
  rf_app_settings: demoSettings,
};

export function isDemoMode(): boolean {
  if (typeof window === "undefined") {
    return import.meta.env.VITE_DEMO_MODE === "true";
  }

  const explicit = import.meta.env.VITE_DEMO_MODE;
  if (explicit === "true") return true;
  if (explicit === "false") return false;

  return window.location.hostname.endsWith(".vercel.app");
}

export function seedDemoData(force = false): void {
  if (!isDemoMode() || typeof window === "undefined") return;
  if (!force && localStorage.getItem("rf_demo_seeded") === DEMO_VERSION) {
    sessionStorage.setItem("rf_current_user_id", demoUser.id);
    sessionStorage.setItem("rf_auth_token", "demo-preview-token");
    return;
  }

  Object.entries(demoData).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
  localStorage.setItem("rf_demo_users", JSON.stringify([demoUser]));
  localStorage.setItem("rf_demo_seeded", DEMO_VERSION);
  sessionStorage.setItem("rf_current_user_id", demoUser.id);
  sessionStorage.setItem("rf_auth_token", "demo-preview-token");
}

export function resetDemoData(): void {
  if (!isDemoMode() || typeof window === "undefined") return;
  Object.keys(demoData).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem("rf_demo_users");
  localStorage.removeItem("rf_demo_seeded");
  sessionStorage.removeItem("rf_current_inventory_session");
  sessionStorage.removeItem("rf_start_count_bin");
  seedDemoData(true);
}

function getDemoUsers(): User[] {
  try {
    const saved = JSON.parse(localStorage.getItem("rf_demo_users") || "[]");
    return Array.isArray(saved) && saved.length ? saved : [demoUser];
  } catch {
    return [demoUser];
  }
}

function saveDemoUsers(users: User[]) {
  localStorage.setItem("rf_demo_users", JSON.stringify(users));
}

function jsonBody(options: RequestInit): any {
  if (!options.body) return {};
  try {
    return JSON.parse(String(options.body));
  } catch {
    return {};
  }
}

// --- Operations (same logic as the real server: server/ops-logic.js) ---

function demoRead(key: string): any[] | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

/** Validate, apply to the stored value, save, and return the result (or throw like the API would). */
function demoApply(
  key: string,
  problem: ops.OpFailure | null,
  apply: (current: any[] | null) => ops.OpOutcome
): any {
  if (problem) throw new Error(problem.error);
  const outcome = apply(demoRead(key));
  const result: any = outcome.result;
  if (result && typeof result === "object" && "error" in result) throw new Error(result.error);
  if (outcome.data !== undefined) localStorage.setItem(key, JSON.stringify(outcome.data));
  return result;
}

/** Returns undefined when the endpoint is not an operation. */
function demoOperation(endpoint: string, method: string, body: any): unknown {
  if (method === "POST" && endpoint === "/ops/append") {
    return demoApply(body.key, ops.validateAppend(body), (cur) => ops.applyAppend(cur, body));
  }
  if (method === "POST" && endpoint === "/ops/bin-adjust") {
    return demoApply("rf_bins", ops.validateBinAdjust(body), (cur) => ops.applyBinAdjust(cur, body));
  }
  if (method === "POST" && endpoint === "/ops/po-receive") {
    return demoApply("rf_purchase_orders", ops.validatePoReceive(body), (cur) => ops.applyPoReceive(cur, body));
  }
  if (method === "POST" && endpoint === "/ops/so-pick") {
    return demoApply("rf_sales_orders", ops.validateSoPick(body), (cur) => ops.applySoPick(cur, body));
  }

  const records = endpoint.match(/^\/records\/([^/]+)\/([^/]+)$/);
  if (records) {
    const key = records[1];
    const id = decodeURIComponent(records[2]);
    if (method === "POST" && id === "upsert-many") {
      return demoApply(key, ops.validateRecordKey(key) || ops.validateUpsertMany(body), (cur) => ops.applyUpsertMany(cur, body));
    }
    if (method === "PUT") {
      return demoApply(key, ops.validateRecordKey(key) || ops.validateRecordUpsert(id, body), (cur) => ops.applyRecordUpsert(cur, body.record));
    }
    if (method === "DELETE") {
      return demoApply(key, ops.validateRecordKey(key), (cur) => ops.applyRecordDelete(cur, id));
    }
  }
  return undefined;
}

export async function demoRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  seedDemoData();
  const method = (options.method || "GET").toUpperCase();
  const body = jsonBody(options);

  if (endpoint === "/health") {
    return { status: "demo", timestamp: new Date().toISOString() } as T;
  }

  if (endpoint === "/auth/login" && method === "POST") {
    const user = getDemoUsers().find(
      (candidate) =>
        candidate.username.toLowerCase() === String(body.username || "").toLowerCase() &&
        candidate.password === body.password &&
        candidate.isActive
    );
    if (!user) throw new Error("Invalid username or password");
    sessionStorage.setItem("rf_current_user_id", user.id);
    sessionStorage.setItem("rf_auth_token", "demo-preview-token");
    return { user, token: "demo-preview-token", expiresIn: "preview" } as T;
  }

  if (endpoint === "/users" && method === "GET") {
    return getDemoUsers() as T;
  }

  if (endpoint === "/users" && method === "POST") {
    const users = getDemoUsers();
    const newUser: User = {
      id: `demo-user-${Date.now()}`,
      username: body.username,
      password: body.password,
      fullName: body.fullName,
      role: body.role,
      isActive: body.isActive !== false,
      createdDate: new Date().toISOString(),
    };
    saveDemoUsers([...users, newUser]);
    return newUser as T;
  }

  if (endpoint.startsWith("/users/")) {
    const userId = endpoint.split("/").pop() || "";
    const users = getDemoUsers();
    const existing = users.find((user) => user.id === userId);

    if (method === "GET") {
      if (!existing) throw new Error("User not found");
      return existing as T;
    }

    if (method === "PUT") {
      const updated = users.map((user) => (user.id === userId ? { ...user, ...body } : user));
      saveDemoUsers(updated);
      return updated.find((user) => user.id === userId) as T;
    }

    if (method === "DELETE") {
      saveDemoUsers(users.filter((user) => user.id !== userId));
      return { message: "Demo user deleted" } as T;
    }
  }

  if (endpoint.startsWith("/data/")) {
    const key = endpoint.slice("/data/".length);
    if (method === "POST") {
      localStorage.setItem(key, JSON.stringify(body.data ?? null));
      return { message: "Saved in isolated preview storage" } as T;
    }

    try {
      return JSON.parse(localStorage.getItem(key) || "null") as T;
    } catch {
      return null as T;
    }
  }

  const opResult = demoOperation(endpoint, method, body);
  if (opResult !== undefined) return opResult as T;

  if (endpoint === "/bins/check-availability") {
    return { available: true, conflicts: [] } as T;
  }

  if (endpoint === "/bins/lock" || endpoint === "/bins/unlock") {
    return { message: "Preview-only bin lock simulated" } as T;
  }

  throw new Error(`Preview mode blocked unsupported API request: ${endpoint}`);
}
