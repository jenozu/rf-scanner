import { Item } from "../types";
import { fullBinCode, looksLikeBinCode } from "./bin-utils";

const buildSearchTerms = (query: string): string[] => {
  const normalized = query.toUpperCase().trim();
  const terms = [normalized];

  const stripped = normalized.replace(/^0+/, "");
  if (stripped && stripped !== normalized) {
    terms.push(stripped);
  }

  return terms;
};

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

  const searchTerms = buildSearchTerms(query);
  
  const matches = allItems.filter(item => {
    const itemCode = item.ItemCode?.toUpperCase() || "";

    // Match against ItemCode (partial)
    if (searchTerms.some(term => itemCode.includes(term))) {
      return true;
    }
    
    // Match against BinCode (with or without warehouse prefix)
    if (item.BinCode) {
      const binCode = item.BinCode.toUpperCase();
      // Try matching with and without prefix
      if (searchTerms.some(term => binCode.includes(term))) {
        return true;
      }
      // If query looks like a bin code, try with prefix added
      const firstTerm = searchTerms[0];
      if (looksLikeBinCode(firstTerm)) {
        const fullBin = fullBinCode(firstTerm);
        if (binCode === fullBin) {
          return true;
        }
      }
    }
    
    // Match against Description (partial)
    const description = item.Description?.toUpperCase() || "";
    if (searchTerms.some(term => description.includes(term))) {
      return true;
    }
    
    return false;
  });

  // Deduplicate by ItemCode - keep only one result per unique ItemCode
  // Use a Map to track unique ItemCodes, keeping the first match for each
  const uniqueItems = new Map<string, Item>();
  matches.forEach(item => {
    const itemCode = item.ItemCode?.toUpperCase() || '';
    if (!uniqueItems.has(itemCode)) {
      uniqueItems.set(itemCode, item);
    }
  });

  // Convert back to array and sort by relevance
  const deduplicated = Array.from(uniqueItems.values());
  return deduplicated.sort((a, b) => {
    // Exact matches first
    if (a.ItemCode === searchTerms[0]) return -1;
    if (b.ItemCode === searchTerms[0]) return 1;
    
    // Then matches that start with the search term
    const aStarts = a.ItemCode?.toUpperCase().startsWith(searchTerms[0]);
    const bStarts = b.ItemCode?.toUpperCase().startsWith(searchTerms[0]);
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
  const searchTerms = buildSearchTerms(query);
  const normalized = searchTerms[0];
  
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
  const exactItem = allItems.find(i => searchTerms.some(term => i.ItemCode?.toUpperCase() === term));
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

