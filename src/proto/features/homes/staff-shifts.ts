import type { Scenario, SectionResult } from "../../types";
import { sectionFor } from "./sections";

export interface UpcomingShift {
  id: string;
  start: string;
  end: string;
  role: string;
  overnight: boolean;
}

export const SHIFTS_PERIOD = "Next 7 days, 17-24 Nov";

const mk = (
  id: string,
  start: string,
  end: string,
  role: string,
): UpcomingShift => ({
  id,
  start,
  end,
  role,
  overnight: end.slice(0, 10) > start.slice(0, 10),
});

/** Synthetic upcoming shifts for the signed-in staff member (published roster only). */
export function upcomingShifts(
  venueId: string,
  scenario: Scenario,
): SectionResult<{ periodLabel: string; shifts: UpcomingShift[] }> {
  return sectionFor(scenario, () => ({
    periodLabel: SHIFTS_PERIOD,
    shifts:
      scenario === "empty"
        ? []
        : [
            mk(
              `${venueId}:us-1`,
              "2026-11-18T09:00",
              "2026-11-18T17:00",
              "Waiter",
            ),
            mk(
              `${venueId}:us-2`,
              "2026-11-20T22:00",
              "2026-11-21T06:00",
              "Bartender",
            ),
            mk(
              `${venueId}:us-3`,
              "2026-11-21T16:00",
              "2026-11-21T22:00",
              "Waiter",
            ),
            mk(
              `${venueId}:us-4`,
              "2026-11-23T09:00",
              "2026-11-23T17:00",
              "Waiter",
            ),
          ],
  }));
}
