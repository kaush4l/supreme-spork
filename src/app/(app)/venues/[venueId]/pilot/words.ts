import type { PilotMeasure, PilotWeek } from "@/server/data/pilot";

export type BadgeVariant = "success" | "warning" | "neutral" | "info";

/** The status word on a measure, in the owner's plain words. */
export function statusWords(status: string): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case "met":
      return { label: "Met", variant: "success" };
    case "not_met":
      return { label: "Not met", variant: "warning" };
    case "not_enough_data":
      return { label: "Not enough data yet", variant: "neutral" };
    case "reported":
      return { label: "For information", variant: "info" };
    case "tracked_outside_app":
      return { label: "Tracked outside the app", variant: "neutral" };
    default:
      return { label: status, variant: "neutral" };
  }
}

/** The figure on a card: the backend's percent and its counts, or nothing when it has none. Never worked out here. */
export function figureWords(m: PilotMeasure): string | null {
  if (m.value === null) return null;
  const counts =
    m.numerator !== null && m.denominator !== null
      ? ` (${m.numerator} of ${m.denominator})`
      : "";
  return `${m.value}%${counts}`;
}

export function passMarkWords(m: PilotMeasure): string | null {
  return m.pass_mark === null ? null : `Pass mark ${m.pass_mark}%`;
}

export type WeekRow = Record<string, string> & { id: string };

/** The measures that have a figure for each week (bug triage has none). */
export function weekColumns(measures: PilotMeasure[], weeks: PilotWeek[]) {
  return measures
    .filter((m) => weeks.some((w) => w.counts[m.key] != null))
    .map((m) => ({ key: m.key, header: m.label }));
}

/** One table row per week; each cell is the backend's counts written as "n/d". */
export function weekRows(
  measures: PilotMeasure[],
  weeks: PilotWeek[],
): WeekRow[] {
  const cols = weekColumns(measures, weeks);
  return weeks.map((w) => {
    const row: WeekRow = { id: w.week_start, week: w.week_start };
    for (const c of cols) {
      const cell = w.counts[c.key];
      row[c.key] = cell ? `${cell.numerator}/${cell.denominator}` : "-";
    }
    return row;
  });
}
