import { describe, expect, test } from "bun:test";
import { dayOptions, emptySlot, fromTemplate, toPayload } from "./slots";

describe("dayOptions", () => {
  test("one day, a week and two weeks", () => {
    expect(dayOptions(1)).toEqual([{ value: "0", label: "The day" }]);
    const week = dayOptions(7);
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ value: "0", label: "Monday" });
    expect(week[6]?.label).toBe("Sunday");
    const two = dayOptions(14);
    expect(two[7]).toEqual({ value: "7", label: "Monday, week 2" });
  });
});

describe("slot shaping", () => {
  test("a draft becomes the payload with a numeric day", () => {
    const s = { ...emptySlot("a"), day: "3", position: "Cook", count: 2 };
    expect(toPayload([s])).toEqual([
      { day: 3, position: "Cook", start: "09:00", end: "17:00", count: 2 },
    ]);
  });

  test("a sent slot round-trips", () => {
    const sent = [
      { day: 1, position: "Waiter", start: "10:00", end: "14:00", count: 3 },
    ];
    expect(toPayload(fromTemplate(sent, () => "k"))).toEqual(sent);
  });
});
