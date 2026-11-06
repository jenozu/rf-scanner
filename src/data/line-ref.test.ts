import { describe, expect, it } from "vitest";
import { errorCode, errorDetail, findLine, lineRef, newTxnId, openQty, sameItemCode } from "./line-ref";

describe("line references", () => {
  it("uses the line key when the line has one, the position only for old orders", () => {
    expect(lineRef({ LineKey: "7:2" }, 5)).toEqual({ lineKey: "7:2" });
    expect(lineRef({}, 5)).toEqual({ lineIndex: 5 });
  });

  it("finds the same line after a re-import moved it", () => {
    const items = [{ LineKey: "7:0" }, { LineKey: "7:1" }, { LineKey: "7:2" }];
    expect(findLine(items, { lineKey: "7:2" })).toEqual({ line: items[2], index: 2 });
    const moved = [{ LineKey: "7:9" }, ...items];
    expect(findLine(moved, { lineKey: "7:2" })?.index).toBe(3);
    expect(findLine(moved, { lineKey: "7:99" })).toBeUndefined();
    expect(findLine([{}, {}], { lineIndex: 1 })?.index).toBe(1);
    expect(findLine([{}], { lineIndex: 4 })).toBeUndefined();
  });

  it("reads the server's refusal code and numbers", () => {
    const error = { details: { code: "OVER_PICK", remaining: 3 } };
    expect(errorCode(error)).toBe("OVER_PICK");
    expect(errorDetail(error, "remaining")).toBe(3);
    expect(errorCode(new Error("x"))).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });

  it("makes distinct transaction ids and compares item codes loosely", () => {
    expect(newTxnId("PICK")).not.toBe(newTxnId("PICK"));
    expect(newTxnId("PICK")).toMatch(/^PICK-\d+-/);
    expect(sameItemCode(" abc-1 ", "ABC-1")).toBe(true);
    expect(sameItemCode("abc", "abd")).toBe(false);
  });

  it("works out what is still open without float noise or negatives", () => {
    expect(openQty({ OrderedQty: 5, ReceivedQty: 2 })).toBe(3);
    expect(openQty({ OrderedQty: 0.3, ReceivedQty: 0.1 + 0.2 })).toBe(0);
    expect(openQty({ OrderedQty: 5, DeliveredQty: 7 })).toBe(0);
    expect(openQty({ OrderedQty: 4 })).toBe(4);
  });
});
