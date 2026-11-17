import { describe, expect, test } from "bun:test";
import { addShift, makeDraft } from "./draft";
import {
  discardForVenue,
  EMPTY_STORE,
  getDraft,
  hasUnsaved,
  keepForVenue,
  putDraft,
  settleKept,
  switchGuardDecision,
  wasKept,
} from "./venue-drafts";

const W = "2026-11-16";
const edited = (venue: string) =>
  addShift(makeDraft(venue, W, false), {
    staffId: null,
    role: "Cook",
    start: "2026-11-18T10:00",
    end: "2026-11-18T14:00",
  });

describe("venue drafts", () => {
  test("guard asks only when the venue being left has unsaved edits", () => {
    const clean = putDraft(EMPTY_STORE, makeDraft("v-harbour", W, false));
    expect(switchGuardDecision(clean, "v-harbour", "v-perth")).toBe("allow");
    const s = putDraft(EMPTY_STORE, edited("v-harbour"));
    expect(switchGuardDecision(s, "v-harbour", "v-perth")).toBe("ask");
    expect(switchGuardDecision(s, "v-perth", "v-harbour")).toBe("allow");
  });
  test("kept draft is only visible for its original venue", () => {
    let s = putDraft(EMPTY_STORE, edited("v-harbour"));
    s = keepForVenue(s, "v-harbour");
    expect(getDraft(s, "v-perth", W)).toBeNull();
    expect(getDraft(s, "v-harbour", W)?.edited).toBe(true);
    expect(wasKept(s, "v-harbour")).toBe(true);
    expect(wasKept(s, "v-perth")).toBe(false);
  });
  test("discard drops only that venue's unsaved edits", () => {
    let s = putDraft(EMPTY_STORE, edited("v-harbour"));
    s = putDraft(s, edited("v-perth"));
    s = discardForVenue(keepForVenue(s, "v-harbour"), "v-harbour");
    expect(getDraft(s, "v-harbour", W)).toBeNull();
    expect(hasUnsaved(s, "v-perth")).toBe(true);
    expect(s.kept).toEqual([]);
  });
  test("settleKept clears flag when nothing unsaved remains", () => {
    const s = keepForVenue(
      putDraft(EMPTY_STORE, makeDraft("v-harbour", W, false)),
      "v-harbour",
    );
    expect(settleKept(s, "v-harbour").kept).toEqual([]);
  });
});
