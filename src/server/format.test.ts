import { describe, expect, test } from "bun:test";
import { formatHours, formatMoney, formatSpan } from "./format";

describe("formatting", () => {
  test("times are shown in the venue's time zone", () => {
    expect(
      formatSpan(
        "2026-11-16T23:00:00Z",
        "2026-11-17T07:00:00Z",
        "Australia/Sydney",
      ),
    ).toMatch(/10:00\s?am to 6:00\s?pm/i);
  });
  test("money is dollars from cents", () => {
    expect(formatMoney(13500)).toBe("$135.00");
  });
  test("hours drop a trailing zero", () => {
    expect(formatHours(4.5)).toBe("4.5 h");
    expect(formatHours(8)).toBe("8 h");
    expect(formatHours(7.25)).toBe("7.25 h");
  });
});
