import { expect, test } from "bun:test";
import { newestFirst, offerOutcome, requestOutcome } from "./decided";

test("request outcomes name the decider when the API does", () => {
  expect(requestOutcome("approved", "Maya Chen")).toBe("Approved by Maya Chen");
  expect(requestOutcome("rejected", null)).toBe("Not approved");
  expect(requestOutcome("expired", undefined)).toBe("Expired");
});

test("offer outcomes", () => {
  expect(offerOutcome({ status: "withdrawn" })).toBe("Offer taken back");
  expect(
    offerOutcome({
      status: "filled",
      filled_by: "Tom",
      decided_by_name: "Maya",
    }),
  ).toBe("Given to Tom by Maya");
  expect(
    offerOutcome({ status: "filled", filled_by: "Tom", mode: "first_come" }),
  ).toBe("Taken by Tom (first come)");
});

test("newest first", () => {
  const rows = newestFirst([
    { id: "a", title: "", outcome: "", at: "2026-11-10T00:00:00Z" },
    { id: "b", title: "", outcome: "", at: "2026-11-12T00:00:00Z" },
  ]);
  expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
});
