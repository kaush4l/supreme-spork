import { describe, expect, test } from "bun:test";
import { simulateMutation } from "../../adapter";
import {
  addUpload,
  applyClock,
  completeItem,
  EMPTY_LOCAL,
} from "./staff-actions";

describe("staff actions", () => {
  test("clock in then out", () => {
    const a = applyClock("clock_in");
    expect(a?.state).toBe("clocked_in");
    expect(a?.action).toBe("clock_out");
    expect(applyClock("clock_out")?.action).toBe("none");
    expect(applyClock("none")).toBeNull();
  });
  test("missing clock-out keeps the reported time", () => {
    expect(
      applyClock("report_missing_clock_out", "5:30 pm")?.message,
    ).toContain("5:30 pm");
  });
  test("checklist completion is idempotent", () => {
    const once = completeItem(EMPTY_LOCAL, "cl-1");
    expect(completeItem(once, "cl-1")).toBe(once);
    expect(once.done).toEqual(["cl-1"]);
  });
  test("uploads keep only name and note", () => {
    const l = addUpload(EMPTY_LOCAL, "docket.jpg", "Harbour Fresh");
    expect(l.uploads).toEqual([
      { id: "up-1", name: "docket.jpg", note: "Harbour Fresh" },
    ]);
  });
  test("duplicate click on the same key does not run the mutation twice", () => {
    let n = 0;
    const seen = new Set<string>();
    const run = () =>
      simulateMutation(() => ++n, { scenario: "default", key: "k", seen });
    expect(run().status).toBe("success");
    expect(run().status).toBe("duplicate");
    expect(n).toBe(1);
  });
  test("failure leaves the next attempt (new key) free to run", () => {
    const seen = new Set<string>();
    const a = simulateMutation(() => 1, {
      scenario: "error",
      key: "k#0",
      seen,
    });
    expect(a.status).toBe("failure");
    const b = simulateMutation(() => 1, {
      scenario: "default",
      key: "k#1",
      seen,
    });
    expect(b.status).toBe("success");
  });
});
