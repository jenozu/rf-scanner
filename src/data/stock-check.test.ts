import { describe, it, expect } from "vitest";
import { checkStock, summarizeStock } from "./stock-check";
import type { BinLocation } from "../types";

const bin = (code: string, items: Array<[string, number]>): BinLocation => ({
  BinCode: code, Zone: "Z", Capacity: 100, Status: "active",
  Items: items.map(([ItemCode, Quantity]) => ({ ItemCode, Description: ItemCode, Quantity })),
});

const bins = [bin("A-1", [["MOUSE", 10], ["KEYB", 3]]), bin("B-1", [["MOUSE", 4]]), bin("C-1", [["MOUSE", 0]])];

describe("checkStock", () => {
  it("says ok when the bin holds enough, with the quantity", () => {
    const [r] = checkStock([{ binCode: "A-1", itemCode: "MOUSE", needed: 6 }], bins);
    expect(r).toMatchObject({ status: "ok", inBin: 10, available: 10, short: 0 });
  });

  it("says partial when the bin holds less than needed, and by how much", () => {
    const [r] = checkStock([{ binCode: "A-1", itemCode: "KEYB", needed: 10 }], bins);
    expect(r).toMatchObject({ status: "partial", inBin: 3, available: 3, short: 7 });
  });

  it("says none when the bin holds none, or the item is not in that bin at all", () => {
    expect(checkStock([{ binCode: "C-1", itemCode: "MOUSE", needed: 2 }], bins)[0]).toMatchObject({ status: "none", inBin: 0, short: 2 });
    expect(checkStock([{ binCode: "B-1", itemCode: "KEYB", needed: 2 }], bins)[0]).toMatchObject({ status: "none", inBin: 0, short: 2 });
  });

  it("lists other bins that hold the item, most first, so the picker knows where else to look", () => {
    const [r] = checkStock([{ binCode: "C-1", itemCode: "MOUSE", needed: 5 }], bins);
    expect(r.elsewhere).toEqual([{ binCode: "A-1", quantity: 10 }, { binCode: "B-1", quantity: 4 }]);
  });

  it("shares a bin's stock between lines of the same item in order", () => {
    const results = checkStock([
      { binCode: "B-1", itemCode: "MOUSE", needed: 3 },
      { binCode: "B-1", itemCode: "MOUSE", needed: 3 },
    ], bins);
    expect(results[0]).toMatchObject({ status: "ok", available: 4 });
    expect(results[1]).toMatchObject({ status: "partial", available: 1, short: 2 });
  });

  it("lines for different items or bins do not share stock", () => {
    const results = checkStock([
      { binCode: "A-1", itemCode: "MOUSE", needed: 10 },
      { binCode: "A-1", itemCode: "KEYB", needed: 3 },
      { binCode: "B-1", itemCode: "MOUSE", needed: 4 },
    ], bins);
    expect(results.map((r) => r.status)).toEqual(["ok", "ok", "ok"]);
  });

  it("cannot check a line without a bin, or with a bin that is not in the system", () => {
    expect(checkStock([{ itemCode: "MOUSE", needed: 1 }], bins)[0]).toMatchObject({ status: "no-bin", inBin: null });
    expect(checkStock([{ binCode: "  ", itemCode: "MOUSE", needed: 1 }], bins)[0].status).toBe("no-bin");
    expect(checkStock([{ binCode: "Z-9", itemCode: "MOUSE", needed: 1 }], bins)[0]).toMatchObject({ status: "unknown-bin", inBin: null });
  });

  it("ignores upper/lower case and stray spaces in codes", () => {
    const [r] = checkStock([{ binCode: " a-1 ", itemCode: "mouse", needed: 2 }], bins);
    expect(r).toMatchObject({ status: "ok", inBin: 10 });
  });

  it("a line that needs nothing is ok", () => {
    expect(checkStock([{ binCode: "C-1", itemCode: "MOUSE", needed: 0 }], bins)[0].status).toBe("ok");
  });
});

describe("summarizeStock", () => {
  it("counts partial, none and unchecked lines", () => {
    const results = checkStock([
      { binCode: "A-1", itemCode: "MOUSE", needed: 1 },
      { binCode: "A-1", itemCode: "KEYB", needed: 9 },
      { binCode: "C-1", itemCode: "MOUSE", needed: 1 },
      { itemCode: "MOUSE", needed: 1 },
      { binCode: "Z-9", itemCode: "MOUSE", needed: 1 },
    ], bins);
    expect(summarizeStock(results)).toEqual({ partial: 1, none: 1, unchecked: 2 });
  });
});
