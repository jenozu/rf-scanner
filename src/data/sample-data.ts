import { 
  PurchaseOrder, 
  Order, 
  Wave, 
  BinLocation, 
  CycleCount, 
  Item 
} from "../types";

/**
 * Sample Purchase Orders for Receiving module
 */
export const samplePurchaseOrders: PurchaseOrder[] = [
  {
    id: "po-001",
    poNumber: "PO-2025-001",
    vendor: "Tech Supplies Inc.",
    status: "pending",
    expectedDate: "2025-10-28",
    items: [
      { ItemCode: "MOUSE-001", Description: "Wireless Mouse", OrderedQty: 50, ReceivedQty: 0 },
      { ItemCode: "KEYB-001", Description: "Mechanical Keyboard", OrderedQty: 30, ReceivedQty: 0 },
      { ItemCode: "MON-001", Description: "24\" LED Monitor", OrderedQty: 20, ReceivedQty: 0 },
    ],
  },
  {
    id: "po-002",
    poNumber: "PO-2025-002",
    vendor: "Office Essentials Co.",
    status: "receiving",
    expectedDate: "2025-10-27",
    items: [
      { ItemCode: "DESK-001", Description: "Standing Desk", OrderedQty: 15, ReceivedQty: 10, BinCode: "A-01-01" },
      { ItemCode: "CHAIR-001", Description: "Ergonomic Chair", OrderedQty: 25, ReceivedQty: 15, BinCode: "A-01-02" },
    ],
  },
  {
    id: "po-003",
    poNumber: "PO-2025-003",
    vendor: "Electronics Wholesale",
    status: "pending",
    expectedDate: "2025-10-29",
    items: [
      { ItemCode: "LAPTOP-001", Description: "Business Laptop", OrderedQty: 10, ReceivedQty: 0 },
      { ItemCode: "TABLET-001", Description: "10\" Tablet", OrderedQty: 20, ReceivedQty: 0 },
    ],
  },
];

/**
 * Sample Orders for Picking module
 */
export const sampleOrders: Order[] = [
  {
    id: "ord-001",
    orderNumber: "ORD-2025-101",
    customer: "ABC Corporation",
    priority: "urgent",
    status: "pending",
    items: [
      { ItemCode: "MOUSE-001", Description: "Wireless Mouse", OrderedQty: 5, PickedQty: 0, BinCode: "B-02-01" },
      { ItemCode: "KEYB-001", Description: "Mechanical Keyboard", OrderedQty: 5, PickedQty: 0, BinCode: "B-02-02" },
    ],
  },
  {
    id: "ord-002",
    orderNumber: "ORD-2025-102",
    customer: "XYZ Enterprises",
    priority: "normal",
    status: "pending",
    items: [
      { ItemCode: "MON-001", Description: "24\" LED Monitor", OrderedQty: 3, PickedQty: 0, BinCode: "B-03-01" },
      { ItemCode: "DESK-001", Description: "Standing Desk", OrderedQty: 2, PickedQty: 0, BinCode: "A-01-01" },
    ],
  },
  {
    id: "ord-003",
    orderNumber: "ORD-2025-103",
    customer: "Tech Startup LLC",
    priority: "normal",
    status: "pending",
    items: [
      { ItemCode: "LAPTOP-001", Description: "Business Laptop", OrderedQty: 4, PickedQty: 0, BinCode: "C-01-01" },
      { ItemCode: "MOUSE-001", Description: "Wireless Mouse", OrderedQty: 8, PickedQty: 0, BinCode: "B-02-01" },
    ],
  },
  {
    id: "ord-004",
    orderNumber: "ORD-2025-104",
    customer: "Retail Store Chain",
    priority: "urgent",
    status: "pending",
    items: [
      { ItemCode: "TABLET-001", Description: "10\" Tablet", OrderedQty: 10, PickedQty: 0, BinCode: "C-02-01" },
      { ItemCode: "CHAIR-001", Description: "Ergonomic Chair", OrderedQty: 6, PickedQty: 0, BinCode: "A-01-02" },
    ],
  },
  {
    id: "ord-005",
    orderNumber: "ORD-2025-105",
    customer: "Small Business Inc.",
    priority: "normal",
    status: "pending",
    items: [
      { ItemCode: "KEYB-001", Description: "Mechanical Keyboard", OrderedQty: 3, PickedQty: 0, BinCode: "B-02-02" },
      { ItemCode: "MON-001", Description: "24\" LED Monitor", OrderedQty: 3, PickedQty: 0, BinCode: "B-03-01" },
    ],
  },
];

/**
 * Sample Waves for batch picking
 */
export const sampleWaves: Wave[] = [
  {
    id: "wave-001",
    waveNumber: "WAVE-001",
    orders: ["ord-001", "ord-002"],
    status: "pending",
    createdDate: "2025-10-28T08:00:00",
  },
  {
    id: "wave-002",
    waveNumber: "WAVE-002",
    orders: ["ord-003", "ord-004", "ord-005"],
    status: "pending",
    createdDate: "2025-10-28T09:00:00",
  },
];

/**
 * Sample Bin Locations for warehouse
 */
export const sampleBinLocations: BinLocation[] = [
  {
    BinCode: "A-01-01",
    Zone: "Zone A - Furniture",
    Capacity: 100,
    Status: "active",
    Items: [
      { ItemCode: "DESK-001", Description: "Standing Desk", Quantity: 10 },
    ],
  },
  {
    BinCode: "A-01-02",
    Zone: "Zone A - Furniture",
    Capacity: 100,
    Status: "active",
    Items: [
      { ItemCode: "CHAIR-001", Description: "Ergonomic Chair", Quantity: 15 },
    ],
  },
  {
    BinCode: "B-02-01",
    Zone: "Zone B - Electronics",
    Capacity: 200,
    Status: "active",
    Items: [
      { ItemCode: "MOUSE-001", Description: "Wireless Mouse", Quantity: 45 },
    ],
  },
  {
    BinCode: "B-02-02",
    Zone: "Zone B - Electronics",
    Capacity: 200,
    Status: "active",
    Items: [
      { ItemCode: "KEYB-001", Description: "Mechanical Keyboard", Quantity: 30 },
    ],
  },
  {
    BinCode: "B-03-01",
    Zone: "Zone B - Electronics",
    Capacity: 150,
    Status: "active",
    Items: [
      { ItemCode: "MON-001", Description: "24\" LED Monitor", Quantity: 18 },
    ],
  },
  {
    BinCode: "C-01-01",
    Zone: "Zone C - Computing",
    Capacity: 50,
    Status: "active",
    Items: [
      { ItemCode: "LAPTOP-001", Description: "Business Laptop", Quantity: 12 },
    ],
  },
  {
    BinCode: "C-02-01",
    Zone: "Zone C - Computing",
    Capacity: 100,
    Status: "active",
    Items: [
      { ItemCode: "TABLET-001", Description: "10\" Tablet", Quantity: 25 },
    ],
  },
  {
    BinCode: "D-01-01",
    Zone: "Zone D - Receiving",
    Capacity: 500,
    Status: "active",
    Items: [],
  },
  {
    BinCode: "E-01-01",
    Zone: "Zone E - Shipping",
    Capacity: 500,
    Status: "active",
    Items: [],
  },
];

/**
 * Sample Cycle Counts for inventory module
 */
export const sampleCycleCounts: CycleCount[] = [
  {
    id: "cc-001",
    BinCode: "B-02-01",
    ItemCode: "MOUSE-001",
    ExpectedQty: 45,
    Status: "pending",
  },
  {
    id: "cc-002",
    BinCode: "B-02-02",
    ItemCode: "KEYB-001",
    ExpectedQty: 30,
    Status: "pending",
  },
  {
    id: "cc-003",
    BinCode: "A-01-01",
    ItemCode: "DESK-001",
    ExpectedQty: 10,
    Status: "pending",
  },
  {
    id: "cc-004",
    BinCode: "C-01-01",
    ItemCode: "LAPTOP-001",
    ExpectedQty: 12,
    Status: "pending",
  },
  {
    id: "cc-005",
    BinCode: "C-02-01",
    ItemCode: "TABLET-001",
    ExpectedQty: 25,
    Status: "pending",
  },
];

/**
 * Sample Items (for backward compatibility with existing scan page)
 */
export const sampleItems: Item[] = [
  {
    BinCode: "B-02-01",
    ItemCode: "MOUSE-001",
    Description: "Wireless Mouse",
    ExpectedQty: 45,
    CountedQty: 0,
    Variance: 0,
  },
  {
    BinCode: "B-02-02",
    ItemCode: "KEYB-001",
    Description: "Mechanical Keyboard",
    ExpectedQty: 30,
    CountedQty: 0,
    Variance: 0,
  },
  {
    BinCode: "B-03-01",
    ItemCode: "MON-001",
    Description: "24\" LED Monitor",
    ExpectedQty: 18,
    CountedQty: 0,
    Variance: 0,
  },
  {
    BinCode: "A-01-01",
    ItemCode: "DESK-001",
    Description: "Standing Desk",
    ExpectedQty: 10,
    CountedQty: 0,
    Variance: 0,
  },
  {
    BinCode: "A-01-02",
    ItemCode: "CHAIR-001",
    Description: "Ergonomic Chair",
    ExpectedQty: 15,
    CountedQty: 0,
    Variance: 0,
  },
  {
    BinCode: "C-01-01",
    ItemCode: "LAPTOP-001",
    Description: "Business Laptop",
    ExpectedQty: 12,
    CountedQty: 0,
    Variance: 0,
  },
  {
    BinCode: "C-02-01",
    ItemCode: "TABLET-001",
    Description: "10\" Tablet",
    ExpectedQty: 25,
    CountedQty: 0,
    Variance: 0,
  },
];

/**
 * Initialize all sample data in localStorage
 */
export function initializeSampleData() {
  localStorage.setItem("rf_purchase_orders", JSON.stringify(samplePurchaseOrders));
  localStorage.setItem("rf_orders", JSON.stringify(sampleOrders));
  localStorage.setItem("rf_waves", JSON.stringify(sampleWaves));
  localStorage.setItem("rf_bins", JSON.stringify(sampleBinLocations));
  localStorage.setItem("rf_cycle_counts", JSON.stringify(sampleCycleCounts));
  localStorage.setItem("rf_active", JSON.stringify(sampleItems));
  console.log("✅ Sample data initialized");
}

/**
 * Clear all data from localStorage
 */
export function clearAllData() {
  localStorage.removeItem("rf_purchase_orders");
  localStorage.removeItem("rf_orders");
  localStorage.removeItem("rf_waves");
  localStorage.removeItem("rf_bins");
  localStorage.removeItem("rf_cycle_counts");
  localStorage.removeItem("rf_active");
  console.log("🗑️ All data cleared");
}

