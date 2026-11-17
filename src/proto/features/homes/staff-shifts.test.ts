import { describe, expect, test } from "bun:test";
import { upcomingShifts } from "./staff-shifts";

describe("upcomingShifts", () => {
  test("includes an overnight shift flagged by date", () => {
    const r = upcomingShifts("v-harbour", "default");
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.data.shifts.filter((s) => s.overnight)).toHaveLength(1);
  });
  test("empty scenario is empty, error scenario is an error", () => {
    const e = upcomingShifts("v-harbour", "empty");
    expect(e.status === "ok" && e.data.shifts.length).toBe(0);
    expect(upcomingShifts("v-harbour", "error").status).toBe("error");
  });
});
