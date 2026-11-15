/** The profit and loss page's period and range from the address. Pure: days are plain `YYYY-MM-DD` strings. */
import { addDays, isDay, weekOf } from "../timesheet/range";

export const PERIOD_CHOICES = ["day", "week", "month"] as const;
export type PeriodChoice = (typeof PERIOD_CHOICES)[number];

export function choosePeriod(value: unknown): PeriodChoice {
  return PERIOD_CHOICES.find((p) => p === value) ?? "week";
}

/** The last finished Monday-to-Sunday week before `today` (the range the page opens on). */
export function lastFinishedWeek(today: string): { from: string; to: string } {
  return weekOf(addDays(today, -7));
}

/** The range from the address, or null when it is missing, invalid or backwards (the API then picks the last finished week). */
export function choosePnlRange(
  from: unknown,
  to: unknown,
): { from: string; to: string } | null {
  if (isDay(from) && isDay(to) && from <= to) return { from, to };
  return null;
}

/** A non-negative whole number from the address, else 0. */
export function chooseOffset(value: unknown): number {
  if (typeof value !== "string" || !/^\d{1,7}$/.test(value)) return 0;
  return Number(value);
}
