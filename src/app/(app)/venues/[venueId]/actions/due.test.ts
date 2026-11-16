import { expect, test } from "bun:test";
import { withZone } from "./due";

test("a Sydney summer time carries +11:00", () => {
  expect(withZone("2026-11-17T09:00", "Australia/Sydney")).toBe(
    "2026-11-17T09:00:00+11:00",
  );
});

test("a Sydney winter time carries +10:00", () => {
  expect(withZone("2026-07-01T09:30", "Australia/Sydney")).toBe(
    "2026-07-01T09:30:00+10:00",
  );
});

test("the day daylight saving starts and ends uses the right side", () => {
  // Sydney moves clocks on 2026-10-04 (2am to 3am) and 2026-04-05 (3am to 2am).
  expect(withZone("2026-10-04T12:00", "Australia/Sydney")).toBe(
    "2026-10-04T12:00:00+11:00",
  );
  expect(withZone("2026-10-04T01:00", "Australia/Sydney")).toBe(
    "2026-10-04T01:00:00+10:00",
  );
  expect(withZone("2026-04-05T12:00", "Australia/Sydney")).toBe(
    "2026-04-05T12:00:00+10:00",
  );
});

test("a zone behind UTC is negative", () => {
  expect(withZone("2026-01-15T08:00", "America/New_York")).toBe(
    "2026-01-15T08:00:00-05:00",
  );
});
