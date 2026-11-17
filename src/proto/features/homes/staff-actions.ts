import type { StaffToday } from "../../fixtures/home";

export type ClockInfo = NonNullable<
  Extract<StaffToday["shifts"], { status: "ok" }>["data"]
>["clock"];
export type ClockAction = ClockInfo["action"];

export interface StaffLocal {
  /** Result of a simulated clock action, layered over the fixture clock. */
  clock?: ClockInfo;
  /** Time the person said they finished (missing clock-out report). */
  reported?: string;
  /** Checklist item ids completed in this session. */
  done: string[];
  /** Simulated uploads: file NAME only, nothing is read. */
  uploads: { id: string; name: string; note: string }[];
}

export const EMPTY_LOCAL: StaffLocal = { done: [], uploads: [] };

/** Local venue clock time at the fixture reference instant. */
export const NOW_LABEL = "10:30 am";

/** Next clock state after a successful simulated action. Pure so it can be tested. */
export function applyClock(
  action: ClockAction,
  reportedTime?: string,
): ClockInfo | null {
  switch (action) {
    case "clock_in":
      return {
        state: "clocked_in",
        clockedInAt: "2026-11-17T10:30",
        message: `Clocked in at ${NOW_LABEL}.`,
        action: "clock_out",
      };
    case "clock_out":
      return {
        state: "clocked_out",
        message: `Clocked out at ${NOW_LABEL}. Thanks for your shift.`,
        action: "none",
      };
    case "report_missing_clock_out":
      return {
        state: "clocked_out",
        message: `Reported: you finished yesterday at ${reportedTime ?? "the scheduled end"}. Your manager will confirm it.`,
        action: "none",
      };
    default:
      return null;
  }
}

export function completeItem(local: StaffLocal, id: string): StaffLocal {
  if (local.done.includes(id)) return local;
  return { ...local, done: [...local.done, id] };
}

export function addUpload(
  local: StaffLocal,
  name: string,
  note: string,
): StaffLocal {
  return {
    ...local,
    uploads: [
      ...local.uploads,
      { id: `up-${local.uploads.length + 1}`, name, note },
    ],
  };
}

export const ACTION_LABEL: Record<ClockAction, string> = {
  clock_in: "Clock in",
  clock_out: "Clock out",
  report_missing_clock_out: "Report missing clock-out",
  none: "",
};
