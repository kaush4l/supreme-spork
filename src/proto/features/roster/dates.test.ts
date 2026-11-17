import { describe, expect, test } from "bun:test";
import {
  composeTimes,
  endsNextDay,
  fmtDay,
  fmtTime,
  shiftsContinuingOnto,
  shiftsStartingOn,
  shiftWithDates,
  weekDays,
  weekLabel,
} from "./dates";

const sh = (id: string, start: string, end: string) => ({
  id,
  venueId: "v",
  staffId: "s-001",
  start,
  end,
  role: "Cook",
});

describe("roster dates", () => {
  test("12-hour times and app dates", () => {
    expect(fmtTime("22:00")).toBe("10:00 pm");
    expect(fmtTime("06:00")).toBe("6:00 am");
    expect(fmtTime("00:15")).toBe("12:15 am");
    expect(fmtTime("12:00")).toBe("12:00 pm");
    expect(fmtDay("2026-11-20")).toBe("Fri 20 Nov");
    expect(weekLabel("2026-11-16")).toBe("Mon 16 Nov to Sun 22 Nov");
    expect(weekDays("2026-11-16")).toHaveLength(7);
  });
  test("overnight shift keeps start day and shows both dates", () => {
    const s = sh("a", "2026-11-20T22:00", "2026-11-21T06:00");
    expect(endsNextDay(s)).toBe(true);
    expect(shiftWithDates(s)).toBe("Fri 20 Nov 10:00 pm to Sat 21 Nov 6:00 am");
    expect(shiftsStartingOn([s], "2026-11-20")).toHaveLength(1);
    expect(shiftsStartingOn([s], "2026-11-21")).toHaveLength(0);
    expect(shiftsContinuingOnto([s], "2026-11-21")).toHaveLength(1);
    expect(shiftsContinuingOnto([s], "2026-11-20")).toHaveLength(0);
  });
  test("compose crosses month end", () => {
    expect(
      composeTimes({
        startDay: "2026-11-30",
        startTime: "22:00",
        endTime: "06:00",
        nextDay: true,
      }),
    ).toEqual({ start: "2026-11-30T22:00", end: "2026-12-01T06:00" });
  });
  test("ending exactly at midnight does not continue", () => {
    const s = sh("a", "2026-11-20T18:00", "2026-11-21T00:00");
    expect(shiftsContinuingOnto([s], "2026-11-21")).toHaveLength(0);
  });
});
