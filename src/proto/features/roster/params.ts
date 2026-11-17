import { REFERENCE_DATE } from "../../fixtures/time";
import type { ShiftRecord } from "../../types";

export const ROSTER_FILTERS = ["open", "leave", "changed", "unfilled"] as const;
export type RosterFilter = (typeof ROSTER_FILTERS)[number];

export interface RosterParams {
  /** YYYY-MM-DD to show (the week containing it is displayed), or null. */
  day: string | null;
  view: "agenda" | "grid" | null;
  filter: RosterFilter | null;
  /** Human notices for values that are present but cannot be honoured. */
  notices: string[];
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Drill-down query from Home: `day`, `view`, `filter`. Unsupported values produce a notice, never a silent skip. */
export function parseRosterParams(sp: URLSearchParams): RosterParams {
  const notices: string[] = [];
  let day: string | null = null;
  const rawDay = sp.get("day");
  if (rawDay !== null) {
    if (rawDay === "today") day = REFERENCE_DATE;
    else if (YMD.test(rawDay) && !Number.isNaN(Date.parse(rawDay)))
      day = rawDay;
    else
      notices.push(`Day "${rawDay}" is not a date, so today's week is shown.`);
  }
  let view: RosterParams["view"] = null;
  const rawView = sp.get("view");
  if (rawView !== null) {
    if (rawView === "agenda" || rawView === "grid") view = rawView;
    else
      notices.push(
        `View "${rawView}" is not available here, so the default view is shown.`,
      );
  }
  let filter: RosterFilter | null = null;
  const rawFilter = sp.get("filter");
  if (rawFilter !== null) {
    const f = ROSTER_FILTERS.find((x) => x === rawFilter);
    if (f) filter = f;
    else
      notices.push(
        `Filter "${rawFilter}" is not supported, so all shifts are shown.`,
      );
  }
  return { day, view, filter, notices };
}

export const FILTER_LABEL: Record<RosterFilter, string> = {
  open: "Open shifts",
  unfilled: "Unfilled shifts",
  leave: "Leave",
  changed: "Changed since published",
};

export function filterShifts(
  shifts: ShiftRecord[],
  filter: RosterFilter | null,
  markers: Record<string, unknown>,
): ShiftRecord[] {
  if (!filter) return shifts;
  switch (filter) {
    case "open":
    case "unfilled":
      return shifts.filter((s) => s.staffId === null);
    case "leave":
      return shifts.filter((s) => s.leave === true);
    case "changed":
      return shifts.filter((s) => markers[s.id] !== undefined || s.changed);
  }
}
