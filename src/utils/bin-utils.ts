import { Item, BinLocation, BinItem } from "../types";

/**
 * Utility functions for handling bin codes
 * Warehouse prefix "01-" is used internally but hidden from users
 */

const WAREHOUSE_PREFIX = "01-";
const DEFAULT_BIN_CAPACITY = 1000;

/**
 * Remove warehouse prefix from bin code for display
 * Example: "01-0002" → "0002"
 */
export function displayBinCode(binCode: string): string {
  if (binCode.startsWith(WAREHOUSE_PREFIX)) {
    return binCode.substring(WAREHOUSE_PREFIX.length);
  }
  return binCode;
}

/**
 * Add warehouse prefix to bin code for internal use
 * Example: "0002" → "01-0002"
 * If already has prefix, returns as-is
 */
export function fullBinCode(binCode: string): string {
  if (binCode.startsWith(WAREHOUSE_PREFIX)) {
    return binCode;
  }
  return WAREHOUSE_PREFIX + binCode;
}

/**
 * Check if input might be a bin code (short numeric string)
 */
export function looksLikeBinCode(input: string): boolean {
  // Bin codes are typically 4-6 digits, possibly with dashes
  // Examples: "0002", "0528", "01-0002"
  const cleaned = input.replace(/-/g, "");
  return /^\d{2,6}$/.test(cleaned);
}

/**
 * Normalize bin code input from user
 * Handles various input formats and adds prefix if needed
 */
export function normalizeBinInput(input: string): string {
  const trimmed = input.trim().toUpperCase();
  
  // If already has warehouse prefix, return as-is
  if (trimmed.startsWith(WAREHOUSE_PREFIX)) {
    return trimmed;
  }
  
  // If it looks like a bin code, add prefix
  if (looksLikeBinCode(trimmed)) {
    return fullBinCode(trimmed);
  }
  
  // Otherwise, return as-is (might be an item code)
  return trimmed;
}

function inferZoneFromBinCode(binCode: string): string {
  const parts = binCode.split("-");
  if (parts.length > 1 && parts[0]) {
    const prefix = parts[0];
    return `Zone ${prefix.toUpperCase()}`;
  }
  return "General";
}

/**
 * Build BinLocation objects from a flat Item list.
 * Ensures sequential counting has the same structure as receiving/picking modules.
 */
export function buildBinsFromItems(items: Item[]): BinLocation[] {
  const binMap = new Map<
    string,
    {
      zone: string;
      items: Map<string, BinItem>;
    }
  >();

  items.forEach((item) => {
    const rawBinCode = item.BinCode?.trim();
    if (!rawBinCode) {
      return;
    }
    const binCode = rawBinCode.toUpperCase();
    if (!binMap.has(binCode)) {
      binMap.set(binCode, {
        zone: inferZoneFromBinCode(binCode),
        items: new Map(),
      });
    }
    const binEntry = binMap.get(binCode)!;
    const quantity = item.CountedQty ?? item.ExpectedQty ?? 0;
    const description = item.Description?.trim() || item.ItemCode;
    const existingItem = binEntry.items.get(item.ItemCode);
    if (existingItem) {
      existingItem.Quantity += quantity;
    } else {
      binEntry.items.set(item.ItemCode, {
        ItemCode: item.ItemCode,
        Description: description,
        Quantity: quantity,
      });
    }
  });

  return Array.from(binMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([binCode, data]) => ({
      BinCode: binCode,
      Zone: data.zone,
      Capacity: DEFAULT_BIN_CAPACITY,
      Status: "active" as const,
      Items: Array.from(data.items.values()).sort((a, b) =>
        a.ItemCode.localeCompare(b.ItemCode)
      ),
    }));
}

