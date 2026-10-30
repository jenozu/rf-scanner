import { describe, it, expect } from "vitest";
import { clearDataCheck, replaceInventoryWarning, sampleDataBlockedReason, REAL_DATA_THRESHOLD } from "./setup-guards";

describe("sampleDataBlockedReason", () => {
  it("allows sample data on an empty or small (sample-sized) inventory", () => {
    expect(sampleDataBlockedReason(0)).toBeNull();
    expect(sampleDataBlockedReason(7)).toBeNull();
    expect(sampleDataBlockedReason(REAL_DATA_THRESHOLD)).toBeNull();
  });

  it("blocks it once the server holds real-looking inventory and says how much", () => {
    expect(sampleDataBlockedReason(REAL_DATA_THRESHOLD + 1)).toMatch(/21 inventory items/);
    expect(sampleDataBlockedReason(5000)).toMatch(/5000/);
  });
});

describe("clearDataCheck", () => {
  it("refuses anyone who is not an admin, even with the right word", () => {
    for (const role of ["operator", "viewer", undefined]) {
      expect(clearDataCheck(role, "CLEAR")).toEqual({ allowed: false, reason: expect.stringMatching(/administrator/) });
    }
  });

  it("refuses a cancelled or wrong confirmation", () => {
    expect(clearDataCheck("admin", null)).toMatchObject({ allowed: false });
    expect(clearDataCheck("admin", "")).toMatchObject({ allowed: false });
    expect(clearDataCheck("admin", "clear all")).toMatchObject({ allowed: false });
    expect(clearDataCheck("admin", "yes")).toMatchObject({ allowed: false });
  });

  it("allows an admin who typed the word (spaces ignored)", () => {
    expect(clearDataCheck("admin", "CLEAR")).toEqual({ allowed: true });
    expect(clearDataCheck("admin", " CLEAR ")).toEqual({ allowed: true });
  });
});

describe("replaceInventoryWarning", () => {
  it("does not nag when there is nothing real to lose", () => {
    expect(replaceInventoryWarning(0, "a.xlsx")).toBeNull();
    expect(replaceInventoryWarning(REAL_DATA_THRESHOLD, "a.xlsx")).toBeNull();
  });

  it("explains what is lost, for everyone, when real inventory exists", () => {
    const text = replaceInventoryWarning(1200, "SAP_export.xlsx")!;
    expect(text).toMatch(/SAP_export\.xlsx/);
    expect(text).toMatch(/1200 inventory items/);
    expect(text).toMatch(/ALL bins/);
    expect(text).toMatch(/EVERY device/);
    expect(text).toMatch(/received, picked or counted/);
  });

  it("works without a file name", () => {
    expect(replaceInventoryWarning(50)).toMatch(/this file/);
  });
});
