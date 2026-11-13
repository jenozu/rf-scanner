import { describe, expect, it } from "vitest";
import type { BinLocation } from "../../types";
import { buildSequentialItems, countLogsToCsv, planFullCount, selectBinsForCount, uploadedRowsToCounts } from "./counting-logic";

const bin = (BinCode: string, items: Array<[string, number]> = [["A", 1]]): BinLocation => ({
  BinCode, Zone: "Z1", Capacity: 0, Status: "active",
  Items: items.map(([ItemCode, Quantity]) => ({ ItemCode, Description: `desc ${ItemCode}`, Quantity })) as any,
});

describe("selectBinsForCount", () => {
  const bins = [bin("01-10"), bin("01-2"), bin("02-1"), bin("01-9")];

  it("takes an aisle by prefix, in numeric bin order, and locks first to last", () => {
    const r = selectBinsForCount(bins, { mode: "aisle", aisle: " 01 " });
    expect(r.ok && r.bins.map((b) => b.BinCode)).toEqual(["01-2", "01-9", "01-10"]);
    expect(r.ok && [r.startBin, r.endBin]).toEqual(["01-2", "01-10"]);
  });

  it("takes a range in either order, numeric-aware", () => {
    const r = selectBinsForCount(bins, { mode: "range", startBin: "01-10", endBin: "01-2" });
    expect(r.ok && r.bins.map((b) => b.BinCode)).toEqual(["01-2", "01-9", "01-10"]);
  });

  it("explains what is missing or empty", () => {
    expect(selectBinsForCount(bins, { mode: "aisle", aisle: "" })).toMatchObject({ ok: false });
    expect(selectBinsForCount(bins, { mode: "aisle", aisle: "09" })).toMatchObject({ ok: false });
    expect(selectBinsForCount(bins, { mode: "range", startBin: "01-2" })).toMatchObject({ ok: false });
    expect(selectBinsForCount(bins, { mode: "range", startBin: "05-1", endBin: "05-9" })).toMatchObject({ ok: false });
  });
});

describe("buildSequentialItems", () => {
  it("lists every item of every bin, in the order given", () => {
    const items = buildSequentialItems([bin("01-1", [["A", 3], ["B", 0]]), bin("01-2", [["C", 7]])]);
    expect(items.map((i) => `${i.binCode}/${i.itemCode}/${i.expectedQty}`)).toEqual(["01-1/A/3", "01-1/B/0", "01-2/C/7"]);
  });
});

describe("countLogsToCsv", () => {
  it("quotes fields with commas or quotes so the columns stay lined up", () => {
    const csv = countLogsToCsv([{
      sessionId: "s1", sessionName: "Night, aisle 1", username: "andel", timestamp: "t",
      binCode: "01-1", itemCode: "A", description: 'Bolt 1/2" x 3, zinc', expectedQty: 5, countedQty: 4, variance: -1,
    }]);
    const [header, row] = csv.split("\n");
    expect(header.split(",")).toHaveLength(10);
    expect(row).toBe('s1,"Night, aisle 1",andel,t,01-1,A,"Bolt 1/2"" x 3, zinc",5,4,-1');
  });
});

describe("uploadedRowsToCounts", () => {
  it("marks rows with a counted quantity as counted and the rest pending", () => {
    const counts = uploadedRowsToCounts([
      { BinCode: "01-1", ItemCode: "A", Description: "", ExpectedQty: 5, CountedQty: 4 },
      { BinCode: "01-2", ItemCode: "B", Description: "", ExpectedQty: 2 },
    ], 1);
    expect(counts.map((c) => [c.id, c.Status, c.CountedQty])).toEqual([
      ["full-count-1-0", "counted", 4],
      ["full-count-1-1", "pending", 0],
    ]);
  });
});

describe("planFullCount", () => {
  const row = (i: number, over: Record<string, unknown> = {}) =>
    ({ id: `c${i}`, BinCode: "01-1", ItemCode: `I${i}`, ExpectedQty: 1, CountedQty: 1, Status: "counted", ...over }) as any;

  it("sends only counted rows that have a bin and an item code", () => {
    const plan = planFullCount([row(1), row(2, { BinCode: "" }), row(3, { ItemCode: " " }), row(4, { Status: "pending" })]);
    expect(plan.sendable).toBe(1);
    expect(plan.missingCodes).toBe(2);
    expect(plan.notCounted).toBe(1);
  });

  it("splits large files into batches the server accepts", () => {
    const rows = Array.from({ length: 1201 }, (_, i) => row(i));
    const plan = planFullCount(rows);
    expect(plan.batches.map((b) => b.length)).toEqual([500, 500, 201]);
  });
});
