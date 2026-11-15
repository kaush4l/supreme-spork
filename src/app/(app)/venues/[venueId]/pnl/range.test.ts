import { describe, expect, test } from "bun:test";
import {
  chooseOffset,
  choosePeriod,
  choosePnlRange,
  lastFinishedWeek,
} from "./range";

describe("pnl range", () => {
  test("opens on the last finished week", () => {
    expect(lastFinishedWeek("2026-11-16")).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
    expect(lastFinishedWeek("2026-11-15")).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
  });
  test("a good range is kept, a bad one is left to the API", () => {
    expect(choosePnlRange("2026-01-01", "2026-03-01")).toEqual({
      from: "2026-01-01",
      to: "2026-03-01",
    });
    expect(choosePnlRange("junk", "2026-03-01")).toBeNull();
    expect(choosePnlRange("2026-03-02", "2026-03-01")).toBeNull();
    expect(choosePnlRange(undefined, undefined)).toBeNull();
  });
  test("period and offset", () => {
    expect(choosePeriod("month")).toBe("month");
    expect(choosePeriod("year")).toBe("week");
    expect(chooseOffset("50")).toBe(50);
    expect(chooseOffset("-1")).toBe(0);
    expect(chooseOffset(undefined)).toBe(0);
  });
});
