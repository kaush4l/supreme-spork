import { describe, expect, test } from "bun:test";
import { chooseDay, chooseWeek, isDay, neighbourWeeks } from "./weeks";

const weeks = [
  { week_start: "2026-11-09", count: 2 },
  { week_start: "2026-11-02", count: 5 },
  { week_start: "2026-10-12", count: 1 },
];

describe("weeks", () => {
  test("knows a real date", () => {
    expect(isDay("2026-02-29")).toBe(false);
    expect(isDay("2026-11-09")).toBe(true);
    expect(isDay(undefined)).toBe(false);
  });
  test("chooseDay drops rubbish", () => {
    expect(chooseDay("nope")).toBeUndefined();
    expect(chooseDay("2026-11-09")).toBe("2026-11-09");
  });
  test("the address wins, then the current week with findings, then the newest week", () => {
    expect(chooseWeek("2026-10-12", "2026-11-09", weeks)).toBe("2026-10-12");
    expect(chooseWeek(undefined, "2026-11-02", weeks)).toBe("2026-11-02");
    expect(chooseWeek(undefined, "2026-11-16", weeks)).toBe("2026-11-09");
    expect(chooseWeek(undefined, "2026-11-16", [])).toBeUndefined();
  });
  test("neighbours skip empty weeks", () => {
    expect(neighbourWeeks(weeks, "2026-11-02")).toEqual({
      previous: "2026-10-12",
      next: "2026-11-09",
    });
    expect(neighbourWeeks(weeks, "2026-11-09")).toEqual({
      previous: "2026-11-02",
      next: undefined,
    });
    expect(neighbourWeeks(weeks, "2026-10-26").next).toBe("2026-11-02");
  });
});
