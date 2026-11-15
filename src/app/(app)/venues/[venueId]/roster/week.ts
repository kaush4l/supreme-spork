/**
 * Pure helpers for the roster screen. The backend says which week is which; this only adds whole days to a Monday
 * written as `YYYY-MM-DD` (plain date-string math, no time zones) and sorts shifts under the day they start on in the
 * venue's time zone. Nothing here decides a rule.
 */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(date: string): [number, number, number] | null {
  const m = DATE.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d
  )
    return null;
  return [y, mo, d];
}

/** Add whole days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  const p = parts(date);
  if (!p) throw new Error("Not a date.");
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + days))
    .toISOString()
    .slice(0, 10);
}

export function isMonday(date: string): boolean {
  const p = parts(date);
  return (
    p !== null && new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() === 1
  );
}

/** The `?week=` value if it is a real Monday, otherwise null (the page then asks the backend for the week). */
export function parseWeek(value: string | string[] | undefined): string | null {
  return typeof value === "string" && isMonday(value) ? value : null;
}

/** The seven dates of a week, Monday first. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** The calendar date (`YYYY-MM-DD`) of a moment in a time zone. */
export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** `YYYY-MM-DDTHH:mm` wall-clock time of a moment in a time zone, for a form field. */
export function toLocalInput(iso: string, timeZone: string): string {
  const got = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${got.year}-${got.month}-${got.day}T${got.hour}:${got.minute}`;
}

/**
 * What a form field holds turned into what the backend expects: a time with no zone, which it reads as the venue's
 * local time. Anything after the minutes (seconds, a zone the picker added) is dropped. Null when it is not a time.
 */
export function wallTime(value: string | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value ?? "");
  if (!m || parts(m[1]) === null) return null;
  if (Number(m[2]) > 23 || Number(m[3]) > 59) return null;
  return `${m[1]}T${m[2]}:${m[3]}:00`;
}

export type Dated = { start: string };

export type DayGroup<T> = { date: string; shifts: T[] };

/**
 * Put each shift under the day it starts on at the venue, in start order. A shift that starts outside the seven days
 * (the backend counts it in this week by its own trading day) goes in `extra` so it is never hidden.
 */
export function groupByDay<T extends Dated>(
  shifts: readonly T[],
  dates: readonly string[],
  timeZone: string,
): { days: DayGroup<T>[]; extra: T[] } {
  const days = dates.map((date) => ({ date, shifts: [] as T[] }));
  const extra: T[] = [];
  for (const shift of shifts) {
    const day = days.find((d) => d.date === localDate(shift.start, timeZone));
    (day ? day.shifts : extra).push(shift);
  }
  const byStart = (a: T, b: T) => a.start.localeCompare(b.start);
  for (const d of days) d.shifts.sort(byStart);
  extra.sort(byStart);
  return { days, extra };
}
