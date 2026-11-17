import {
  initialRoster,
  RULE_LABEL,
  validateDraft,
} from "../../fixtures/roster";
import type { PublishIssue, ShiftRecord } from "../../types";

export { RULE_LABEL };

/** A roster draft being edited. `edited` = local edits not yet published (the "unsaved" flag). */
export interface WorkingDraft {
  venueId: string;
  weekStart: string;
  version: number;
  shifts: ShiftRecord[];
  published: ShiftRecord[];
  edited: boolean;
  nextNew: number;
}

export type ShiftInput = Omit<ShiftRecord, "id" | "venueId" | "changed">;

function clean(s: ShiftRecord): ShiftRecord {
  const { changed: _c, ...rest } = s;
  return rest;
}

/** Fresh draft for a venue+week from the fixture. Change markers are always recomputed by diffDraft. */
export function makeDraft(
  venueId: string,
  weekStart: string,
  empty: boolean,
): WorkingDraft {
  if (empty)
    return {
      venueId,
      weekStart,
      version: 1,
      shifts: [],
      published: [],
      edited: false,
      nextNew: 1,
    };
  const r = initialRoster(venueId, weekStart);
  return {
    venueId,
    weekStart,
    version: r.version,
    shifts: r.shifts.filter((s) => s.changed !== "removed").map(clean),
    published: r.published.map(clean),
    edited: false,
    nextNew: 1,
  };
}

export function addShift(d: WorkingDraft, input: ShiftInput): WorkingDraft {
  const shift: ShiftRecord = {
    ...input,
    id: `${d.venueId}:${d.weekStart}:new${d.nextNew}`,
    venueId: d.venueId,
  };
  return {
    ...d,
    shifts: [...d.shifts, shift],
    nextNew: d.nextNew + 1,
    edited: true,
  };
}

export function updateShift(
  d: WorkingDraft,
  id: string,
  input: ShiftInput,
): WorkingDraft {
  return {
    ...d,
    shifts: d.shifts.map((s) =>
      s.id === id ? { ...input, id: s.id, venueId: s.venueId } : s,
    ),
    edited: true,
  };
}

export function deleteShift(d: WorkingDraft, id: string): WorkingDraft {
  return { ...d, shifts: d.shifts.filter((s) => s.id !== id), edited: true };
}

/** Put a published shift that was removed from the draft back. */
export function restoreShift(d: WorkingDraft, id: string): WorkingDraft {
  const p = d.published.find((s) => s.id === id);
  if (!p || d.shifts.some((s) => s.id === id)) return d;
  return { ...d, shifts: [...d.shifts, p], edited: true };
}

const sameShift = (a: ShiftRecord, b: ShiftRecord) =>
  a.staffId === b.staffId &&
  a.start === b.start &&
  a.end === b.end &&
  a.role === b.role &&
  !!a.leave === !!b.leave;

export interface DraftDiff {
  added: ShiftRecord[];
  edited: { before: ShiftRecord; after: ShiftRecord }[];
  removed: ShiftRecord[];
}

/** Draft versus the published snapshot. */
export function diffDraft(d: WorkingDraft): DraftDiff {
  const pub = new Map(d.published.map((s) => [s.id, s]));
  const cur = new Set(d.shifts.map((s) => s.id));
  const added: ShiftRecord[] = [];
  const edited: DraftDiff["edited"] = [];
  for (const s of d.shifts) {
    const before = pub.get(s.id);
    if (!before) added.push(s);
    else if (!sameShift(before, s)) edited.push({ before, after: s });
  }
  const removed = d.published.filter((s) => !cur.has(s.id));
  return { added, edited, removed };
}

export function hasChanges(diff: DraftDiff): boolean {
  return diff.added.length + diff.edited.length + diff.removed.length > 0;
}

export type Marker = "added" | "edited";
export const MARKER_LABEL: Record<Marker | "removed", string> = {
  added: "Added since published",
  edited: "Edited since published",
  removed: "Removed since published",
};

export function markersFor(diff: DraftDiff): Record<string, Marker> {
  const m: Record<string, Marker> = {};
  for (const s of diff.added) m[s.id] = "added";
  for (const e of diff.edited) m[e.after.id] = "edited";
  return m;
}

/** Backend-style fixture warnings only (no award or rest rules). */
export function issuesOf(d: WorkingDraft): PublishIssue[] {
  return validateDraft({
    venueId: d.venueId,
    weekStart: d.weekStart,
    version: d.version,
    shifts: d.shifts,
    published: d.published,
  });
}

export function blockingOf(issues: PublishIssue[]): PublishIssue[] {
  return issues.filter((i) => i.severity === "blocking");
}
export function advisoryOf(issues: PublishIssue[]): PublishIssue[] {
  return issues.filter((i) => i.severity === "advisory");
}

/** Publish needs at least one change and no blocking error. Advisory warnings never prevent it. */
export function canPublish(d: WorkingDraft): boolean {
  return hasChanges(diffDraft(d)) && blockingOf(issuesOf(d)).length === 0;
}

/** Result of a successful publish: snapshot replaced, version incremented once, unsaved flag cleared. */
export function publishDraft(d: WorkingDraft): WorkingDraft {
  return {
    ...d,
    published: d.shifts.map(clean),
    version: d.version + 1,
    edited: false,
  };
}

/** Stable publish idempotency key: changes after a successful publish (version moves on). */
export function publishKey(d: WorkingDraft): string {
  return `publish:${d.venueId}:${d.weekStart}:v${d.version}`;
}
