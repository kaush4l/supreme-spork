import { describe, expect, test } from "bun:test";
import { allowedText, formatNumber, readingRow, resultText } from "./rows";

const base = {
  trading_day: "2026-11-09",
  answered_at: "2026-11-15T03:33:29.50535+00:00",
  list_id: "L1",
  list_name: "Closing",
  item_key: "K1",
  label: "Fridge temperature in C",
  value: 8.5,
  min_value: 0,
  max_value: 5,
  out_of_range: true,
  answered_by_name: "Priya Nair",
};

describe("readings rows", () => {
  test("numbers have no trailing zeros", () => {
    expect(formatNumber(4)).toBe("4");
    expect(formatNumber(8.5)).toBe("8.5");
    expect(formatNumber(-18.123)).toBe("-18.12");
  });
  test("the allowed range reads in words", () => {
    expect(allowedText(0, 5)).toBe("0 to 5");
    expect(allowedText(null, -15)).toBe("up to -15");
    expect(allowedText(63, null)).toBe("at least 63");
    expect(allowedText(null, null)).toBe("no limit");
  });
  test("the result is a word, not a colour", () => {
    expect(resultText(true)).toBe("Out of range");
    expect(resultText(false)).toBe("In range");
  });
  test("a row is words in the venue's time zone", () => {
    expect(readingRow(base, "Australia/Sydney")).toEqual({
      id: "L1:K1",
      day: "Mon, 9 Nov",
      time: "2:33 pm",
      check: "Fridge temperature in C (Closing)",
      reading: "8.5",
      allowed: "0 to 5",
      result: "Out of range",
      by: "Priya Nair",
      followUp: "",
      followUpPath: null,
    });
  });
  test("a reading with a follow-up says its state and where it is", () => {
    const row = readingRow(
      { ...base, corrective_action_id: "A1", corrective_action_state: "done" },
      "Australia/Sydney",
    );
    expect(row.followUp).toBe("Follow-up done");
    expect(row.followUpPath).toBe("/actions/A1");
    expect(
      readingRow(
        {
          ...base,
          corrective_action_id: "A1",
          corrective_action_state: "open",
        },
        "Australia/Sydney",
      ).followUp,
    ).toBe("Follow-up open");
    expect(
      readingRow(
        { ...base, corrective_action_id: null, corrective_action_state: null },
        "Australia/Sydney",
      ).followUpPath,
    ).toBeNull();
  });
  test("a missing name says so", () => {
    expect(
      readingRow({ ...base, answered_by_name: null }, "Australia/Sydney").by,
    ).toBe("Not known");
  });
});
