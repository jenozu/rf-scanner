import { describe, it, expect } from "vitest";
import { diffRecords, diffBins } from "./diff";
import type { BinLocation } from "../types";

describe("diffRecords", () => {
  it("returns only added and changed records, and removed ids", () => {
    const before = [{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "c", n: 3 }];
    const after = [{ id: "a", n: 1 }, { id: "b", n: 20 }, { id: "d", n: 4 }];
    expect(diffRecords(before, after)).toEqual({ upsert: [{ id: "b", n: 20 }, { id: "d", n: 4 }], remove: ["c"] });
  });

  it("returns nothing when the lists are equal", () => {
    const list = [{ id: "a", nested: { x: 1 } }];
    expect(diffRecords(list, JSON.parse(JSON.stringify(list)))).toEqual({ upsert: [], remove: [] });
  });
});

const bin = (code: string, items: Array<[string, number]>): BinLocation => ({
  BinCode: code, Zone: "Z", Capacity: 10, Status: "active",
  Items: items.map(([ItemCode, Quantity]) => ({ ItemCode, Description: `d-${ItemCode}`, Quantity })),
});

describe("diffBins", () => {
  it("lists only the items whose quantity changed or that are new", () => {
    const before = [bin("A", [["X", 5], ["Y", 1]]), bin("B", [["X", 2]])];
    const after = [bin("A", [["X", 4], ["Y", 1], ["Z", 9]]), bin("B", [["X", 2]])];
    expect(diffBins(before, after).changes).toEqual([
      { binCode: "A", itemCode: "X", description: "d-X", setQuantity: 4 },
      { binCode: "A", itemCode: "Z", description: "d-Z", setQuantity: 9 },
    ]);
    expect(diffBins(before, after).newBins).toEqual([]);
  });

  it("reports new bins and their items", () => {
    const result = diffBins([bin("A", [])], [bin("A", []), bin("N", [["X", 3]])]);
    expect(result.newBins).toEqual([{ BinCode: "N", Zone: "Z", Capacity: 10, Status: "active" }]);
    expect(result.changes).toEqual([{ binCode: "N", itemCode: "X", description: "d-X", setQuantity: 3 }]);
  });

  it("refuses removals instead of ignoring them", () => {
    expect(() => diffBins([bin("A", [["X", 1]])], [])).toThrow(/Removing bin A/);
    expect(() => diffBins([bin("A", [["X", 1]])], [bin("A", [])])).toThrow(/Removing X from bin A/);
  });

  it("finds nothing to do when nothing changed", () => {
    const list = [bin("A", [["X", 1]])];
    expect(diffBins(list, JSON.parse(JSON.stringify(list)))).toEqual({ newBins: [], changes: [] });
  });
});
