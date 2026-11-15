import { expect, test } from "bun:test";
import { isWallTime, wallTime } from "./wall";

test("shows a moment as venue wall time", () => {
  expect(wallTime("2026-11-16T06:30:00Z", "Australia/Sydney")).toBe(
    "2026-11-16T17:30",
  );
  expect(wallTime("2026-11-16T13:00:00Z", "Australia/Sydney")).toBe(
    "2026-11-17T00:00",
  );
});

test("checks the typed form", () => {
  expect(isWallTime("2026-11-16T17:30")).toBe(true);
  expect(isWallTime("2026-11-16 17:30")).toBe(false);
  expect(isWallTime("2026-11-16T24:00")).toBe(false);
});
