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
  items: POItem[];
  status: "pending" | "receiving" | "completed";
  expectedDate: string;
  receivedDate?: string;
}

export interface POItem {
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
 * License Plate (LP) entity for grouping received items
 */
export interface LicensePlateItem {
  ItemCode: string;
  Description: string;
  qty: number;
  Lots?: Array<{ lotCode: string; qty: number }>;
  Serials?: string[];
}

export interface LicensePlate {
  lpId: string;
  items: LicensePlateItem[];
  createdAt: string;
  binCode: string; // typically STAGING initially
  labels?: string[]; // URLs or identifiers for printed labels (stub)
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
  lpId?: string;
  lots?: Array<{ lotCode: string; qty: number }>;
  serials?: string[];
  timestamp: string;
}

/**
 * Page navigation type used throughout the app
 */
export type PageType = "setup" | "home" | "transactions" | "receive" | "scan" | "pick" | "inventory" | "export" | "settings";

