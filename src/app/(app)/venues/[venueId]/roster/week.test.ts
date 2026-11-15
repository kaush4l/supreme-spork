import { describe, expect, test } from "bun:test";
import {
  addDays,
  groupByDay,
  isMonday,
  localDate,
  parseWeek,
  toLocalInput,
  wallTime,
  weekDates,
} from "./week";

describe("week math", () => {
  test("adds days across month, year and leap day", () => {
    expect(addDays("2026-11-16", 7)).toBe("2026-11-23");
    expect(addDays("2026-11-30", 7)).toBe("2026-12-07");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-11-16", -7)).toBe("2026-11-09");
  });
  test("knows a Monday", () => {
    expect(isMonday("2026-11-16")).toBe(true);
    expect(isMonday("2026-11-17")).toBe(false);
    expect(isMonday("2026-02-31")).toBe(false);
    expect(isMonday("nonsense")).toBe(false);
  });
  test("parseWeek accepts only a real Monday string", () => {
    expect(parseWeek("2026-11-16")).toBe("2026-11-16");
    expect(parseWeek("2026-11-17")).toBeNull();
    expect(parseWeek(["2026-11-16"])).toBeNull();
    expect(parseWeek(undefined)).toBeNull();
  });
  test("seven dates, Monday first", () => {
    const d = weekDates("2026-11-30");
    expect(d).toHaveLength(7);
    expect(d[0]).toBe("2026-11-30");
    expect(d[6]).toBe("2026-12-06");
  });
});

describe("venue-local times", () => {
  test("date and form value are in the venue zone", () => {
    expect(localDate("2026-11-16T23:00:00Z", "Australia/Sydney")).toBe(
      "2026-11-17",
    );
    expect(toLocalInput("2026-11-16T23:30:00Z", "Australia/Sydney")).toBe(
      "2026-11-17T10:30",
    );
  });
  test("wallTime keeps the wall clock and drops any zone", () => {
    expect(wallTime("2026-11-17T09:00")).toBe("2026-11-17T09:00:00");
    expect(wallTime("2026-11-17T09:00:30Z")).toBe("2026-11-17T09:00:00");
    expect(wallTime("2026-11-17")).toBeNull();
    expect(wallTime(undefined)).toBeNull();
    expect(wallTime("2026-11-17T25:00")).toBeNull();
  });
});

describe("grouping", () => {
  const tz = "Australia/Sydney";
  const dates = weekDates("2026-11-16");
  test("shifts go under their local start day, sorted", () => {
    const shifts = [
      { id: "b", start: "2026-11-17T08:00:00Z" },
      { id: "a", start: "2026-11-16T23:00:00Z" },
      { id: "c", start: "2026-11-16T00:00:00Z" },
    ];
    const { days, extra } = groupByDay(shifts, dates, tz);
    expect(days[0].shifts.map((s) => s.id)).toEqual(["c"]);
    expect(days[1].shifts.map((s) => s.id)).toEqual(["a", "b"]);
    expect(extra).toEqual([]);
  });
  test("a shift outside the seven days is kept apart, not lost", () => {
    const { extra } = groupByDay(
      [{ start: "2026-12-30T00:00:00Z" }],
      dates,
      tz,
    );
    expect(extra).toHaveLength(1);
  });
});
