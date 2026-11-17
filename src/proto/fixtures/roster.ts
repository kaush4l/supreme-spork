import type { PublishIssue, RosterDraft, ShiftRecord } from "../types";
import { staff } from "./staff";
import { addDays, wall, wallHours } from "./time";

export const RULE_LABEL = "backend-style fixture rule";

/**
 * Overnight shifts are those whose `end` falls on a later calendar day than `start`. A shift whose end is before
 * its start on the SAME calendar day is invalid (blocking), because it is not overnight-flagged by date.
 */
export function isOvernight(s: Pick<ShiftRecord, "start" | "end">): boolean {
  return s.end.slice(0, 10) > s.start.slice(0, 10);
}

export function initialRoster(venueId: string, weekStart: string): RosterDraft {
  const d = (n: number) => addDays(weekStart, n);
  const mk = (
    id: string,
    staffId: string | null,
    day: number,
    s: string,
    e: string,
    role: string,
    extra: Partial<ShiftRecord> = {},
    endDayOffset = 0,
  ): ShiftRecord => ({
    id: `${venueId}:${weekStart}:${id}`,
    venueId,
    staffId,
    start: wall(d(day), s),
    end: wall(d(day + endDayOffset), e),
    role,
    ...extra,
  });

  const longStaff = staff.find((x) => x.name.length > 45)?.id ?? "s-007";
  const shifts: ShiftRecord[] = [];
  // Regular day shifts for first 14 staff over the week.
  for (let i = 0; i < 14; i++) {
    const st = staff[i];
    if (!st) continue;
    shifts.push(mk(`reg${i}`, st.id, i % 7, "09:00", "17:00", st.role));
  }
  shifts.push(mk("open1", null, 2, "17:00", "23:00", "Waiter"));
  shifts.push(mk("open2", null, 4, "11:00", "15:00", "Cook"));
  shifts.push(mk("night1", "s-020", 4, "22:00", "06:00", "Bartender", {}, 1));
  shifts.push(
    mk(
      "night2",
      longStaff,
      5,
      "22:00",
      "06:00",
      "Supervisor",
      { changed: "added" },
      1,
    ),
  );
  shifts.push(
    mk("leave1", "s-021", 1, "09:00", "17:00", "Chef", { leave: true }),
  );
  // Blocking: assigned to a staff member on leave that day. Advisory: 13h shift.
  shifts.push(mk("onleave1", "s-021", 1, "12:00", "20:00", "Chef"));
  shifts.push(mk("long1", "s-025", 2, "07:00", "20:00", "Cook"));
  shifts.push(
    mk("edited1", "s-022", 3, "10:00", "18:00", "Host", { changed: "edited" }),
  );
  shifts.push(
    mk("added1", "s-023", 3, "16:00", "22:00", "Waiter", { changed: "added" }),
  );

  // Published snapshot: draft minus "added", plus a removed shift, with edited one at old time.
  const published: ShiftRecord[] = shifts
    .filter((s) => s.changed !== "added")
    .map((s) =>
      s.changed === "edited"
        ? {
            ...s,
            changed: undefined,
            start: wall(d(3), "09:00"),
            end: wall(d(3), "17:00"),
          }
        : { ...s, changed: undefined },
    );
  const removed = mk("removed1", "s-024", 6, "12:00", "20:00", "Cook");
  published.push(removed);
  shifts.push({ ...removed, staffId: "s-024", changed: "removed" });

  return { venueId, weekStart, version: 1, shifts, published };
}

/** Backend-style fixture rules only. No award, rest-break or penalty-rate rules are modelled. */
export function validateDraft(draft: RosterDraft): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const onLeave = new Set(
    draft.shifts
      .filter((s) => s.leave && s.staffId)
      .map((s) => `${s.staffId}|${s.start.slice(0, 10)}`),
  );
  for (const s of draft.shifts) {
    if (s.changed === "removed") continue;
    if (s.end <= s.start) {
      issues.push({
        id: `${s.id}:end-before-start`,
        severity: "blocking",
        shiftId: s.id,
        message: `${RULE_LABEL}: shift ends before it starts and is not an overnight shift (end must be on a later day to run overnight).`,
      });
      continue;
    }
    if (
      !s.leave &&
      s.staffId &&
      onLeave.has(`${s.staffId}|${s.start.slice(0, 10)}`)
    ) {
      issues.push({
        id: `${s.id}:on-leave`,
        severity: "blocking",
        shiftId: s.id,
        message: `${RULE_LABEL}: staff member is on leave on this day.`,
      });
    }
    if (wallHours(s.start, s.end) > 12) {
      issues.push({
        id: `${s.id}:long`,
        severity: "advisory",
        shiftId: s.id,
        message: `${RULE_LABEL}: shift is longer than 12 hours.`,
      });
    }
    if (!s.staffId && !s.leave) {
      issues.push({
        id: `${s.id}:open`,
        severity: "advisory",
        shiftId: s.id,
        message: `${RULE_LABEL}: open shift has no one assigned.`,
      });
    }
  }
  return issues;
}
