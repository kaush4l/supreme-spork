import { describe, expect, test } from "bun:test";
import {
  fmtShiftRange,
  fmtWallTime,
  formatCents,
  formatMetricValue,
} from "./format";

describe("format", () => {
  test("cents", () => {
    expect(formatCents(4_812_500)).toBe("$48,125.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(-120_050)).toBe("-$1,200.50");
  });
  test("missing is never zero but a real zero is", () => {
    expect(formatMetricValue({ value: null, unit: "cents" })).toBe("Missing");
    expect(formatMetricValue({ value: 0, unit: "cents" })).toBe("$0.00");
    expect(formatMetricValue({ value: null, unit: "count" })).toBe("Missing");
  });
  test("times", () => {
    expect(fmtWallTime("2026-11-17T00:05")).toBe("12:05 am");
    expect(fmtWallTime("2026-11-17T22:00")).toBe("10:00 pm");
    expect(fmtWallTime("2026-11-17T12:00")).toBe("12:00 pm");
  });
  test("overnight range names both days", () => {
    expect(fmtShiftRange("2026-11-17T22:00", "2026-11-18T06:00")).toBe(
      "Tue 17 Nov, 10:00 pm to 6:00 am Wed 18 Nov",
    );
    expect(fmtShiftRange("2026-11-17T09:00", "2026-11-17T17:00")).toBe(
      "Tue 17 Nov, 9:00 am to 5:00 pm",
    );
  });
});
