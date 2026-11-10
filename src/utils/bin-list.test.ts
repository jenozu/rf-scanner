import { describe, it, expect } from "vitest";
import { parseBinList, lookupBinList } from "./bin-list";
import { BinLocation } from "../types";

const bins: BinLocation[] = [
  {
    BinCode: "01-0002",
    Zone: "A",
    Capacity: 100,
    Status: "active",
    Items: [
      { ItemCode: "P1", Description: "Part 1", Quantity: 5 } as any,
      { ItemCode: "P2", Description: "Part 2", Quantity: 3 } as any,
    ],
  },
  {
    BinCode: "01-0528",
    Zone: "B",
    Capacity: 100,
    Status: "active",
    Items: [],
  },
];

describe("parseBinList", () => {
  it("splits on commas, spaces and newlines and drops duplicates", () => {
    expect(parseBinList("0002, 0528\n0002  0528;0003")).toEqual(["01-0002", "01-0528", "01-0003"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseBinList("  \n , ")).toEqual([]);
  });
});

describe("lookupBinList", () => {
  it("finds bins with and without the warehouse prefix and totals quantities", () => {
    const result = lookupBinList(parseBinList("0002 01-0528"), bins);
    expect(result.found.map((f) => f.code)).toEqual(["0002", "0528"]);
    expect(result.found[0].totalQty).toBe(8);
    expect(result.found[1].totalQty).toBe(0);
    expect(result.totalQty).toBe(8);
    expect(result.notFound).toEqual([]);
  });

  it("reports bins that do not exist", () => {
    const result = lookupBinList(parseBinList("0002 9999"), bins);
    expect(result.found).toHaveLength(1);
    expect(result.notFound).toEqual(["9999"]);
  });
});
