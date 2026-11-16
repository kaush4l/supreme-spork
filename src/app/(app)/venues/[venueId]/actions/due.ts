import { wallTime } from "../timesheet/wall";

/** Minutes the zone is ahead of UTC at a moment (a whole number of minutes). */
function offsetMinutes(utcMs: number, timeZone: string): number {
  const minute = Math.floor(utcMs / 60000) * 60000;
  const wall = wallTime(new Date(minute).toISOString(), timeZone);
  return Math.round((Date.parse(`${wall}:00Z`) - minute) / 60000);
}

/**
 * `2026-11-17T09:00` typed as the venue's wall clock, written with the venue's zone offset
 * (`2026-11-17T09:00:00+11:00`), because the backend refuses a due time without a zone. Formatting only: the
 * backend decides what the time means.
 */
export function withZone(wall: string, timeZone: string): string {
  const naive = Date.parse(`${wall}:00Z`);
  let offset = offsetMinutes(naive, timeZone);
  const second = offsetMinutes(naive - offset * 60000, timeZone);
  if (second !== offset) offset = second;
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${wall}:00${sign}${hh}:${mm}`;
}
