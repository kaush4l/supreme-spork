import { expect, test } from "bun:test";
import {
  blankToNull,
  calendarAddress,
  dayLabel,
  kindLabel,
  splitSkills,
  timeLabel,
  whenLabel,
} from "./person-text";

test("dates and times read plainly", () => {
  expect(dayLabel("2027-03-01")).toBe("1 Mar 2027");
  expect(dayLabel(null)).toBe("");
  expect(timeLabel("09:00:00")).toBe("9:00 am");
  expect(timeLabel("12:30:00")).toBe("12:30 pm");
  expect(timeLabel("00:15:00")).toBe("12:15 am");
});

test("a row says when it applies", () => {
  const base = {
    from_time: null,
    to_time: null,
    start_date: null,
    end_date: null,
    available: true,
  };
  expect(
    whenLabel({
      ...base,
      kind: "weekly",
      weekday: 0,
      from_time: "09:00:00",
      to_time: "17:00:00",
    }),
  ).toBe("Mondays, 9:00 am to 5:00 pm");
  expect(
    whenLabel({
      ...base,
      kind: "once",
      weekday: null,
      start_date: "2026-12-01",
      end_date: "2026-12-05",
    }),
  ).toBe("1 Dec 2026 to 5 Dec 2026");
  expect(
    whenLabel({
      ...base,
      kind: "once",
      weekday: null,
      start_date: "2026-12-01",
      end_date: "2026-12-01",
    }),
  ).toBe("1 Dec 2026");
});

test("skills split, trim and drop repeats", () => {
  expect(splitSkills("cocktails, coffee,, Coffee ,\nRSA")).toEqual([
    "cocktails",
    "coffee",
    "RSA",
  ]);
  expect(splitSkills("")).toEqual([]);
});

test("small helpers", () => {
  expect(calendarAddress("http://x:8000/", "/v1/me/calendar/t.ics")).toBe(
    "http://x:8000/v1/me/calendar/t.ics",
  );
  expect(blankToNull("  ")).toBeNull();
  expect(blankToNull(" a ")).toBe("a");
  expect(kindLabel("first_aid")).toBe("First aid");
});
