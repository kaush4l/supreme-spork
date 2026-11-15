import { expect, test } from "bun:test";
import { groupByDay, offerState } from "./group";

const tz = "Australia/Sydney";

test("groups by the day in the venue's time zone, earliest first", () => {
  const groups = groupByDay(
    [
      { start: "2026-11-17T01:00:00Z", n: 3 }, // 12pm Tue Sydney
      { start: "2026-11-16T13:30:00Z", n: 2 }, // 12:30am Tue Sydney
      { start: "2026-11-16T01:00:00Z", n: 1 }, // 12pm Mon Sydney
    ],
    tz,
  );
  expect(groups.map((g) => g.key)).toEqual(["2026-11-16", "2026-11-17"]);
  expect(groups[1]?.items.map((i) => i.n)).toEqual([2, 3]);
});

test("no shifts, no groups", () => {
  expect(groupByDay([], tz)).toEqual([]);
});

test("claim states in plain words", () => {
  const base = { mode: "first_come", mine: false, my_claim: null };
  expect(offerState(base)).toContain("as soon as");
  expect(offerState({ ...base, mode: "manager" })).toContain("manager decides");
  expect(offerState({ ...base, my_claim: { decision: null } })).toContain(
    "Waiting for your manager",
  );
  expect(offerState({ ...base, my_claim: { decision: "approved" } })).toContain(
    "yours",
  );
  expect(offerState({ ...base, mine: true })).toContain(
    "You put this shift up",
  );
});
