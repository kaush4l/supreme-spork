import { describe, expect, test } from "bun:test";
import {
  clockWords,
  type Day,
  dayWords,
  hoursChanges,
  NUMBER_FIELDS,
  parseClock,
  parseNumber,
} from "./venue-logic";

const day = (over: Partial<Day>): Day => ({
  dow: 1,
  day: "Monday",
  set: true,
  closed: false,
  opens: "09:00",
  closes: "17:00",
  ...over,
});
const [prime, , margin, alert] = NUMBER_FIELDS;

describe("parseNumber", () => {
  test("plain percentages are sent as typed", () => {
    expect(parseNumber("60", prime)).toBe(60);
    expect(parseNumber("32.5", prime)).toBe(32.5);
  });
  test("limits follow the API", () => {
    expect(parseNumber("0", prime)).toBeNull();
    expect(parseNumber("100", prime)).toBe(100);
    expect(parseNumber("100", margin)).toBeNull();
    expect(parseNumber("169", alert)).toBeNull();
    expect(parseNumber("0.5", alert)).toBeNull();
    expect(parseNumber("abc", prime)).toBeNull();
    expect(parseNumber("", prime)).toBeNull();
  });
});

describe("clocks", () => {
  test("parseClock pads and refuses", () => {
    expect(parseClock("4:00")).toBe("04:00");
    expect(parseClock("0400")).toBe("04:00");
    expect(parseClock("24:00")).toBeNull();
    expect(parseClock("9")).toBeNull();
  });
  test("clockWords", () => {
    expect(clockWords("00:30")).toBe("12:30 am");
    expect(clockWords("13:05")).toBe("1:05 pm");
  });
});

describe("dayWords", () => {
  test("open, closed, unset, after midnight", () => {
    expect(dayWords(day({}))).toBe("9:00 am to 5:00 pm");
    expect(dayWords(day({ closed: true, opens: null, closes: null }))).toBe(
      "Closed",
    );
    expect(dayWords(day({ set: false, closed: null }))).toBe("Not set yet");
    expect(dayWords(day({ opens: "17:00", closes: "01:00" }))).toBe(
      "5:00 pm to 1:00 am (closes 1:00 am the next day)",
    );
  });
});

describe("hoursChanges", () => {
  const week = [day({}), day({ dow: 2, day: "Tuesday" })];
  test("nothing changed", () => {
    expect(hoursChanges(week, {}).changes).toEqual([]);
  });
  test("only changed days are sent", () => {
    const r = hoursChanges(week, {
      2: { closed: false, opens: "10:00", closes: "02:00" },
    });
    expect(r.changes).toEqual([
      { dow: 2, closed: false, opens: "10:00", closes: "02:00" },
    ]);
  });
  test("closing a day, and bad times", () => {
    expect(
      hoursChanges(week, { 1: { closed: true, opens: "", closes: "" } })
        .changes,
    ).toEqual([{ dow: 1, closed: true }]);
    expect(
      hoursChanges(week, { 1: { closed: false, opens: "9", closes: "17:00" } })
        .bad,
    ).toEqual(["Monday"]);
  });
  test("an unset day left blank is not a change", () => {
    const r = hoursChanges(
      [day({ set: false, closed: null, opens: null, closes: null })],
      {},
    );
    expect(r.changes).toEqual([]);
    expect(r.bad).toEqual([]);
  });
});
