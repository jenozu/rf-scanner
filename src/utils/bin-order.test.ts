import { describe, expect, it } from "vitest";
import { compareBinCodes, isBinInRange } from "./bin-order";

describe("numeric bin ordering", () => {
  it("sorts numbered bins by number", () => {
    const sorted = ["01-A-10", "01-A-2", "01-A-1"].sort(compareBinCodes);
    expect(sorted).toEqual(["01-A-1", "01-A-2", "01-A-10"]);
  });

  it("includes every bin between 2 and 10, not just some of them", () => {
    const bins = ["1", "2", "3", "5", "9", "10", "11"];
    expect(bins.filter(b => isBinInRange(b, "2", "10"))).toEqual(["2", "3", "5", "9", "10"]);
  });

  it("accepts a reversed range", () => {
    expect(isBinInRange("5", "10", "2")).toBe(true);
  });

  it("ignores case and surrounding spaces", () => {
    expect(compareBinCodes(" 01-a-2 ", "01-A-2")).toBe(0);
  });
});
