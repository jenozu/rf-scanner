import { Item, BinLocation } from "../types";
import { buildBinsFromItems, canonicalBinCode } from "./bin-utils";

const itemKey = (item: Item) =>
  `${(item.ItemCode || "").trim().toUpperCase()}|${canonicalBinCode(item.BinCode || "")}`;

/**
 * Items the scanner searches: the working list (rf_active, which carries counted
 * quantities) plus every master-inventory row it is missing. rf_active can be
 * empty or partial (for example after "Clear data") while rf_master still holds
 * the full SAP inventory, and a part that exists must never come back "not found".
 */
export function mergeScanItems(active: Item[], master: Item[]): Item[] {
  const safeActive = Array.isArray(active) ? active : [];
  const safeMaster = Array.isArray(master) ? master : [];
  const seen = new Set(safeActive.map(itemKey));
  const extra = safeMaster.filter((item) => item?.ItemCode && !seen.has(itemKey(item)));
  return extra.length === 0 ? safeActive : [...safeActive, ...extra];
}

/**
 * Bins the scanner searches: the saved bins plus any bin that appears on an item
 * but is missing from rf_bins.
 */
export function mergeScanBins(savedBins: BinLocation[], items: Item[]): BinLocation[] {
  const safeBins = Array.isArray(savedBins) ? savedBins : [];
  const known = new Set(safeBins.map((b) => canonicalBinCode(b?.BinCode || "")));
  const derived = buildBinsFromItems(items).filter(
    (b) => !known.has(canonicalBinCode(b.BinCode))
  );
  return derived.length === 0 ? safeBins : [...safeBins, ...derived];
}
