import { expect, test } from "bun:test";
import { isDay, pickRange } from "./dates";

test("isDay accepts real days only", () => {
  expect(isDay("2026-11-16")).toBe(true);
  expect(isDay("2026-02-30")).toBe(false);
  expect(isDay("16/11/2026")).toBe(false);
  expect(isDay(undefined)).toBe(false);
});

test("pickRange keeps a good pair and drops a bad one", () => {
  expect(pickRange("2026-11-01", "2026-12-31")).toEqual({
    from: "2026-11-01",
    to: "2026-12-31",
  });
  expect(pickRange("2026-12-31", "2026-11-01")).toEqual({});
  expect(pickRange("x", "2026-11-01")).toEqual({});
});
