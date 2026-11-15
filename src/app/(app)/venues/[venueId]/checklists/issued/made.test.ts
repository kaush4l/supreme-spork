import { expect, test } from "bun:test";
import { madeWords } from "./made";

test("says how many were made and how many were already there", () => {
  expect(
    madeWords({
      weekStart: "2026-11-09",
      shifts: 4,
      issued: 1,
      alreadyIssued: 3,
    }),
  ).toBe(
    "Made 1 new list for the week starting 2026-11-09 (4 shifts). 3 were already there.",
  );
});
test("says plainly when there was nothing to do", () => {
  expect(
    madeWords({
      weekStart: "2026-11-02",
      shifts: 0,
      issued: 0,
      alreadyIssued: 0,
    }),
  ).toContain("Nothing to do");
});
