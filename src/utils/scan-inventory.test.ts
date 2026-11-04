import { describe, expect, it } from "vitest";
import { mergeScanBins, mergeScanItems } from "./scan-inventory";
import { smartSearch } from "./search-utils";
import type { Item } from "../types";

const item = (ItemCode: string, BinCode: string, ExpectedQty = 1): Item =>
  ({ ItemCode, BinCode, Description: ItemCode, ExpectedQty }) as Item;

describe("scanner inventory", () => {
  it("finds a part that is only in the master list (active list cleared)", () => {
    const items = mergeScanItems([], [item("2992047-DTZ", "01-SYSTEM-BIN-LOCATION", 0)]);
    const result = smartSearch("02992047", mergeScanBins([], items), items);
    expect(result?.item?.ItemCode).toBe("2992047-DTZ");
  });

  it("finds a bin known only from item data", () => {
    const items = mergeScanItems([], [item("4258759-DTZ", "01-0209")]);
    const result = smartSearch("0209", mergeScanBins([], items), items);
    expect(result?.type).toBe("bin");
    expect(result?.bin?.BinCode).toBe("01-0209");
  });

  it("prefers the active row (counted quantity) over the master row", () => {
    const active = [item("A1", "01-0001", 7)];
    const merged = mergeScanItems(active, [item("A1", "0001", 3), item("B2", "01-0002")]);
    expect(merged).toHaveLength(2);
    expect(merged.find((i) => i.ItemCode === "A1")?.ExpectedQty).toBe(7);
  });

  it("does not duplicate bins already saved, with or without the prefix", () => {
    const bins = mergeScanBins([{ BinCode: "0209", Items: [] } as any], [item("X", "01-0209")]);
    expect(bins).toHaveLength(1);
  });
});
