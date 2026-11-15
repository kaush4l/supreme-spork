import { describe, expect, test } from "bun:test";
import { centsToInput, dollarsToCents } from "./money-input";

describe("dollarsToCents", () => {
  test("whole and part dollars", () => {
    expect(dollarsToCents("28")).toBe(2800);
    expect(dollarsToCents("28.5")).toBe(2850);
    expect(dollarsToCents("$1,028.05")).toBe(102805);
  });
  test("blank is nothing typed", () => {
    expect(dollarsToCents("  ")).toBeNull();
  });
  test("rubbish is invalid", () => {
    expect(dollarsToCents("abc")).toBe("invalid");
    expect(dollarsToCents("-3")).toBe("invalid");
    expect(dollarsToCents("1.234")).toBe("invalid");
  });
});

describe("centsToInput", () => {
  test("pads cents", () => {
    expect(centsToInput(2805)).toBe("28.05");
    expect(centsToInput(0)).toBe("0.00");
    expect(centsToInput(null)).toBe("");
  });
});
