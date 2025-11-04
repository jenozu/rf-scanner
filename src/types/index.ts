/**
 * Core data types for RF Warehouse Management System
 * Single source of truth for all interfaces
 */

export interface Item {
  BinCode: string;
  ItemCode: string;
  Description: string;
  ExpectedQty: number;
  CountedQty?: number; // Optional until counted
  Variance?: number;   // Optional until counted
}

/**
 * Purchase Order for receiving workflow
 */
export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  cardCode?: string; // Vendor code (SAP CardCode)
  items: POItem[];
  status: "pending" | "receiving" | "completed";
  expectedDate: string;
  receivedDate?: string;
}

export interface POItem {
  LineNumber?: number; // Line number for sorting
  ItemCode: string;
  Description: string;
  OrderedQty: number;
  ReceivedQty: number;
  /** Convenience: remaining to receive (may be recomputed at runtime) */
  RemainingQty?: number;
  BinCode?: string;
  /** Whether this line requires lot/serial capture */
  RequiresLotSerial?: boolean;
  /** Captured lots for this PO line */
  Lots?: Array<{
    lotCode: string;
    qty: number;
    mfgDate?: string;
    expDate?: string;
    attrs?: Record<string, string | number | boolean>;
  }>;
  /** Captured serials for this PO line */
  Serials?: string[];
}

/**
 * Customer Order for picking workflow
 */
export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  items: OrderItem[];
  status: "pending" | "picking" | "picked" | "shipped";
  waveId?: string;
  priority: "normal" | "urgent";
}

export interface OrderItem {
  ItemCode: string;
  Description: string;
  OrderedQty: number;
  PickedQty: number;
  BinCode: string;
}

/**
 * Sales Order (outbound) for picking workflow
 * Imported from CSV with multiple SO numbers in one file
 */
export interface SalesOrder {
  id: string;
  soNumber: string;
  customer: string;
  cardCode: string; // Customer code
  items: SOItem[];
  status: "pending" | "picking" | "picked" | "shipped";
  createdDate: string;
  shippedDate?: string;
}

export interface SOItem {
  LineNumber: number;
  ItemCode: string;
  Description: string;
  OrderedQty: number;
  DeliveredQty: number;
  /** Remaining quantity to pick/ship */
  RemainingQty?: number;
  BinCode?: string; // Suggested bin for picking
}

/**
 * Wave for batch picking
 */
export interface Wave {
  id: string;
  waveNumber: string;
  orders: string[]; // Order IDs
  status: "pending" | "active" | "completed";
  createdDate: string;
  completedDate?: string;
}

/**
 * Bin Location for warehouse management
 */
export interface BinLocation {
  BinCode: string;
  Zone: string;
  Items: BinItem[];
  Capacity: number;
  Status: "active" | "inactive";
}

export interface BinItem {
  ItemCode: string;
  Description: string;
  Quantity: number;
  /** Optional lot breakdown for the quantity */
  Lots?: Array<{ lotCode: string; qty: number }>;
  /** Optional serials stored in this bin */
  Serials?: string[];
}

/**
 * Cycle Count for inventory accuracy
 */
export interface CycleCount {
  id: string;
  BinCode: string;
  ItemCode: string;
  ExpectedQty: number;
  CountedQty?: number;
  Variance?: number;
  CountDate?: string;
  Status: "pending" | "counted" | "completed";
}

/**
 * User for authentication and multi-user support
 */
export interface User {
  id: string;
  username: string;
  password: string; // In production, this should be hashed
  fullName: string;
  role: "admin" | "operator" | "viewer";
  isActive: boolean;
  createdDate: string;
  lastLogin?: string;
}

/**
 * Activity log for tracking user actions
 */
export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  timestamp: string;
  details?: string;
}

/**
 * App settings
 */
export interface AppSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoLogout: boolean;
  autoLogoutMinutes: number;
  showActivityLog: boolean;
  theme: "light" | "dark";
}

/**
 * Receiving transaction log entry
 */
export interface ReceivingTransaction {
  id: string;
  poNumber: string;
  itemCode: string;
  description: string;
  qty: number;
  binCode: string; // where staged
  lots?: Array<{ lotCode: string; qty: number }>;
  serials?: string[];
  timestamp: string;
}

/**
 * Cycle Count transaction log entry
 */
export interface CycleCountTransaction {
  id: string;
  binCode: string;
  itemCode: string;
  description: string;
  expectedQty: number;
  countedQty: number;
  variance: number;
  timestamp: string;
}

/**
 * Inventory Transfer transaction log entry
 */
export interface TransferTransaction {
  id: string;
  itemCode: string;
  description: string;
  sourceBin: string;
  destinationBin: string;
  qty: number;
  timestamp: string;
}

/**
 * Inventory Session for managing counting sessions
 */
export interface InventorySession {
  id: string;
  name: string;
  createdDate: string;
  lastAccessedDate: string;
  status: "active" | "paused" | "completed";
  cycleCountIds: string[]; // IDs of cycle counts in this session
  currentCycleCountId?: string; // Currently active count
}

/**
 * Temporary Location for holding misplaced items
 */
export interface TemporaryLocation {
  id: string;
  title: string;
  description: string;
  createdDate: string;
  items: TemporaryLocationItem[];
}

export interface TemporaryLocationItem {
  itemCode: string;
  description: string;
  quantity: number;
  sourceBin?: string; // Where it came from
  movedDate: string;
}

/**
 * Page navigation type used throughout the app
 */
export type PageType = "setup" | "home" | "transactions" | "receive" | "scan" | "pick" | "inventory" | "export" | "settings";

