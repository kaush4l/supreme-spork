import type { WorkingDraft } from "./draft";

/**
 * All roster drafts of the session, keyed by venue+week, plus the venues whose draft the person chose to keep when
 * switching away. A draft is bound to the venue it was created in and is never returned for another venue.
 */
export interface DraftStore {
  drafts: Record<string, WorkingDraft>;
  kept: string[];
}

export const EMPTY_STORE: DraftStore = { drafts: {}, kept: [] };

export const draftKey = (venueId: string, weekStart: string) =>
  `${venueId}|${weekStart}`;

export function getDraft(
  s: DraftStore,
  venueId: string,
  weekStart: string,
): WorkingDraft | null {
  const d = s.drafts[draftKey(venueId, weekStart)];
  return d && d.venueId === venueId && d.weekStart === weekStart ? d : null;
}

export function putDraft(s: DraftStore, d: WorkingDraft): DraftStore {
  return {
    ...s,
    drafts: { ...s.drafts, [draftKey(d.venueId, d.weekStart)]: d },
  };
}

/** Drafts of a venue with unsaved edits. */
export function unsavedFor(s: DraftStore, venueId: string): WorkingDraft[] {
  return Object.values(s.drafts).filter(
    (d) => d.venueId === venueId && d.edited,
  );
}

export function hasUnsaved(s: DraftStore, venueId: string): boolean {
  return unsavedFor(s, venueId).length > 0;
}

/** "Keep draft for <original venue>": nothing is deleted; the venue is marked so the draft is flagged when it returns. */
export function keepForVenue(s: DraftStore, venueId: string): DraftStore {
  return s.kept.includes(venueId) ? s : { ...s, kept: [...s.kept, venueId] };
}

/** "Discard draft": unsaved drafts of that venue are dropped (published snapshots come back from the fixture). */
export function discardForVenue(s: DraftStore, venueId: string): DraftStore {
  const drafts: Record<string, WorkingDraft> = {};
  for (const [k, d] of Object.entries(s.drafts))
    if (!(d.venueId === venueId && d.edited)) drafts[k] = d;
  return { drafts, kept: s.kept.filter((v) => v !== venueId) };
}

export function wasKept(s: DraftStore, venueId: string): boolean {
  return s.kept.includes(venueId) && hasUnsaved(s, venueId);
}

/** Clear the kept flag once the venue has no unsaved edits left (after publish). */
export function settleKept(s: DraftStore, venueId: string): DraftStore {
  return hasUnsaved(s, venueId)
    ? s
    : { ...s, kept: s.kept.filter((v) => v !== venueId) };
}

/** The venue-switch decision as a pure function for the guard. */
export function switchGuardDecision(
  s: DraftStore,
  from: string,
  to: string,
): "allow" | "ask" {
  return from !== to && hasUnsaved(s, from) ? "ask" : "allow";
}
