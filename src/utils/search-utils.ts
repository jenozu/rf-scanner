import { Item } from "../types";
import { fullBinCode, looksLikeBinCode } from "./bin-utils";

export interface SearchResult {
  type: "bin" | "item";
  bin?: any;
  item?: Item;
  matches?: Item[];
}

/**
 * Search for items using partial matching
 * Supports partial item codes, bin codes, and descriptions
 */
export function searchItems(query: string, allItems: Item[]): Item[] {
  if (!query || query.length < 2) return [];

  const searchTerm = query.toUpperCase().trim();
  
  const matches = allItems.filter(item => {
    // Match against ItemCode (partial)
    if (item.ItemCode?.toUpperCase().includes(searchTerm)) {
      return true;
    }
    
    // Match against BinCode (with or without warehouse prefix)
    if (item.BinCode) {
      const binCode = item.BinCode.toUpperCase();
      // Try matching with and without prefix
      if (binCode.includes(searchTerm)) {
        return true;
      }
      // If query looks like a bin code, try with prefix added
      if (looksLikeBinCode(searchTerm)) {
        const fullBin = fullBinCode(searchTerm);
        if (binCode === fullBin) {
          return true;
        }
      }
    }
    
    // Match against Description (partial)
    if (item.Description?.toUpperCase().includes(searchTerm)) {
      return true;
    }
    
    return false;
  });

  // Sort by relevance
  return matches.sort((a, b) => {
    // Exact matches first
    if (a.ItemCode === searchTerm) return -1;
    if (b.ItemCode === searchTerm) return 1;
    
    // Then matches that start with the search term
    const aStarts = a.ItemCode?.toUpperCase().startsWith(searchTerm);
    const bStarts = b.ItemCode?.toUpperCase().startsWith(searchTerm);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    
    // Otherwise alphabetical
    return a.ItemCode.localeCompare(b.ItemCode);
  });
}

/**
 * Smart search that handles both bins and items
 * Returns the best match or multiple matches if ambiguous
 */
export function smartSearch(query: string, bins: any[], allItems: Item[]): SearchResult | null {
  const normalized = query.toUpperCase().trim();
  
  // Try exact bin match first (with prefix normalization)
  let binToFind = normalized;
  if (looksLikeBinCode(normalized)) {
    binToFind = fullBinCode(normalized);
  }
  
  const exactBin = bins.find(b => b.BinCode.toUpperCase() === binToFind);
  if (exactBin) {
    return { type: "bin", bin: exactBin };
  }
  
  // Try exact item match
  const exactItem = allItems.find(i => i.ItemCode?.toUpperCase() === normalized);
  if (exactItem) {
    return { type: "item", item: exactItem };
  }
  
  // Try partial search
  const itemMatches = searchItems(query, allItems);
  
  if (itemMatches.length === 1) {
    // Single match - return it
    return { type: "item", item: itemMatches[0] };
  } else if (itemMatches.length > 1) {
    // Multiple matches - return all
    return { type: "item", matches: itemMatches };
  }
  
  // No matches
  return null;
}

