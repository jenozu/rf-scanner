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
  BinCode?: string;
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
 * Page navigation type used throughout the app
 */
export type PageType = "setup" | "home" | "receive" | "scan" | "pick" | "inventory" | "export";

