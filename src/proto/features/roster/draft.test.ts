import { describe, expect, test } from "bun:test";
import {
  addShift,
  advisoryOf,
  blockingOf,
  canPublish,
  deleteShift,
  diffDraft,
  issuesOf,
  makeDraft,
  markersFor,
  publishDraft,
  publishKey,
  restoreShift,
  updateShift,
} from "./draft";

const W = "2026-11-16";

describe("draft", () => {
  test("fixture diff: one added pair, one edited, one removed", () => {
    const d = makeDraft("v-harbour", W, false);
    const diff = diffDraft(d);
    expect(diff.added.map((s) => s.id.split(":").pop())).toEqual(
      expect.arrayContaining(["night2", "added1"]),
    );
    expect(diff.edited).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(Object.values(markersFor(diff)).sort()).toEqual([
      "added",
      "added",
      "edited",
    ]);
  });
  test("blocking error prevents publish, advisory does not", () => {
    const d = makeDraft("v-harbour", W, false);
    expect(blockingOf(issuesOf(d)).length).toBeGreaterThan(0);
    expect(advisoryOf(issuesOf(d)).length).toBeGreaterThan(0);
    expect(canPublish(d)).toBe(false);
    const onleave = d.shifts.find((s) => s.id.endsWith("onleave1"));
    const fixed = deleteShift(d, onleave?.id ?? "");
    expect(blockingOf(issuesOf(fixed))).toHaveLength(0);
    expect(advisoryOf(issuesOf(fixed)).length).toBeGreaterThan(0);
    expect(canPublish(fixed)).toBe(true);
  });
  test("overnight edit keeps both dates; same-day end before start blocks", () => {
    let d = makeDraft("v-harbour", W, false);
    const night = d.shifts.find((s) => s.id.endsWith("night1"));
    expect(night?.end).toBe("2026-11-21T06:00");
    d = updateShift(d, night?.id ?? "", {
      staffId: "s-020",
      role: "Bartender",
      start: "2026-11-20T21:00",
      end: "2026-11-21T05:00",
    });
    const e = diffDraft(d).edited.find((x) => x.after.id === night?.id);
    expect(e?.after.end).toBe("2026-11-21T05:00");
    const bad = updateShift(d, night?.id ?? "", {
      staffId: "s-020",
      role: "Bartender",
      start: "2026-11-20T21:00",
      end: "2026-11-20T05:00",
    });
    expect(blockingOf(issuesOf(bad)).map((i) => i.shiftId)).toContain(
      night?.id ?? "",
    );
  });
  test("add, restore removed, edit back to published clears marker", () => {
    let d = makeDraft("v-harbour", W, false);
    d = addShift(d, {
      staffId: null,
      role: "Cook",
      start: "2026-11-18T10:00",
      end: "2026-11-18T14:00",
    });
    expect(d.edited).toBe(true);
    expect(d.shifts[d.shifts.length - 1]?.id).toBe("v-harbour:2026-11-16:new1");
    const removed = diffDraft(d).removed[0];
    d = restoreShift(d, removed?.id ?? "");
    expect(diffDraft(d).removed).toHaveLength(0);
  });
  test("publish increments version once and clears changes", () => {
    const d = deleteShift(
      makeDraft("v-harbour", W, false),
      "v-harbour:2026-11-16:onleave1",
    );
    const k1 = publishKey(d);
    const p = publishDraft(d);
    expect(p.version).toBe(d.version + 1);
    expect(p.edited).toBe(false);
    expect(diffDraft(p).added).toHaveLength(0);
    expect(canPublish(p)).toBe(false);
    expect(publishKey(p)).not.toBe(k1);
  });
  test("empty venue draft", () => {
    const d = makeDraft("v-empty", W, true);
    expect(d.shifts).toHaveLength(0);
    expect(canPublish(d)).toBe(false);
  });
});
