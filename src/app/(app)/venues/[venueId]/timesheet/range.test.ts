import { describe, expect, test } from "bun:test";
import { addDays, chooseRange, isDay, todayIn, weekOf } from "./range";

describe("timesheet range", () => {
  test("days must be real dates", () => {
    expect(isDay("2026-11-15")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("15/11/2026")).toBe(false);
    expect(isDay(undefined)).toBe(false);
  });
  test("adding days crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  test("the week runs Monday to Sunday", () => {
    expect(weekOf("2026-11-15")).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
    expect(weekOf("2026-11-16")).toEqual({
      from: "2026-11-16",
      to: "2026-11-22",
    });
    expect(weekOf("2026-11-11")).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
  });
  test("today follows the venue's time zone", () => {
    const now = new Date("2026-11-15T14:30:00Z");
    expect(todayIn(now, "Australia/Sydney")).toBe("2026-11-16");
    expect(todayIn(now, "America/Los_Angeles")).toBe("2026-11-15");
  });
  test("a good range is kept, a bad one becomes this week", () => {
    expect(chooseRange("2026-11-01", "2026-11-30", "2026-11-15")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    const week = { from: "2026-11-09", to: "2026-11-15" };
    expect(chooseRange(undefined, undefined, "2026-11-15")).toEqual(week);
    expect(chooseRange("2026-11-20", "2026-11-10", "2026-11-15")).toEqual(week);
    expect(chooseRange("2026-01-01", "2026-12-31", "2026-11-15")).toEqual(week);
    expect(chooseRange("nope", "2026-11-10", "2026-11-15")).toEqual(week);
  });
});
