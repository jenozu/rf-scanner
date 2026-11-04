import { describe, expect, it } from "vitest";
import { smartSearch } from "./search-utils";
import { isSameBin } from "./bin-utils";
import type { Item } from "../types";

const item = (over: Partial<Item>): Item =>
  ({
    ItemCode: "A1",
    Description: "Test item",
    BinCode: "",
    ExpectedQty: 1,
    ...over,
  }) as Item;

describe("bin matching ignores the 01- warehouse prefix", () => {
  it("finds a bin stored with the prefix when scanned without it", () => {
    const bins = [{ BinCode: "01-0209", Items: [] }];
    const result = smartSearch("0209", bins, []);
    expect(result?.type).toBe("bin");
    expect(result?.bin?.BinCode).toBe("01-0209");
  });

  it("finds a bin stored without the prefix when scanned with it", () => {
    const bins = [{ BinCode: "0209", Items: [] }];
    const result = smartSearch("01-0209", bins, []);
    expect(result?.type).toBe("bin");
    expect(result?.bin?.BinCode).toBe("0209");
  });

  it("does not confuse different bins", () => {
    const bins = [{ BinCode: "01-0209", Items: [] }];
    expect(smartSearch("01-0210", bins, [])).toBeNull();
  });

  it("finds items whose BinCode is stored without the prefix", () => {
    const items = [item({ ItemCode: "X9", BinCode: "0209" })];
    const result = smartSearch("0209", [], items);
    expect(result?.type).toBe("item");
    expect(result?.item?.ItemCode).toBe("X9");
  });

  it("isSameBin treats leading zeros as significant", () => {
    expect(isSameBin("01-0209", "0209")).toBe(true);
    expect(isSameBin("01-0209", "209")).toBe(false);
  });
});
