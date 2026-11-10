import { BinLocation } from "../types";
import { displayBinCode, isSameBin, normalizeBinInput } from "./bin-utils";

/**
 * Turn free-typed bin codes ("0002, 0003 0528" or one per line) into a clean list.
 * Duplicates are dropped and the original order is kept.
 */
export function parseBinList(input: string): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normalizeBinInput(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    codes.push(key);
  }
  return codes;
}

export interface BinListLine {
  code: string;
  bin: BinLocation | null;
}

export interface BinListResult {
  found: { code: string; bin: BinLocation; totalQty: number }[];
  notFound: string[];
  totalQty: number;
}

/**
 * Look up each requested bin code against the bins on this device.
 * Returns the bins that exist (with their items and a quantity total) and the codes that don't.
 */
export function lookupBinList(codes: string[], bins: BinLocation[]): BinListResult {
  const found: BinListResult["found"] = [];
  const notFound: string[] = [];
  for (const code of codes) {
    const bin = bins.find((b) => isSameBin(b.BinCode, code));
    if (!bin) {
      notFound.push(displayBinCode(code));
      continue;
    }
    const totalQty = bin.Items.reduce((sum, item) => sum + (Number(item.Quantity) || 0), 0);
    found.push({ code: displayBinCode(bin.BinCode), bin, totalQty });
  }
  return {
    found,
    notFound,
    totalQty: found.reduce((sum, f) => sum + f.totalQty, 0),
  };
}
