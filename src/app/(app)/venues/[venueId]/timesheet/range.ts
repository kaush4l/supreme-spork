/** Date math for the timesheet's from/to. Pure: days are plain `YYYY-MM-DD` strings, never instants. */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DAY.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === value;
}

export function addDays(day: string, n: number): string {
  const m = DAY.exec(day);
  if (!m) throw new Error("Not a day.");
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n))
    .toISOString()
    .slice(0, 10);
}

/** The calendar day it is now in a time zone. */
export function todayIn(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Monday to Sunday of the week holding `day`. */
export function weekOf(day: string): { from: string; to: string } {
  const m = DAY.exec(day);
  if (!m) throw new Error("Not a day.");
  const weekday = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  const back = (weekday + 6) % 7;
  const from = addDays(day, -back);
  return { from, to: addDays(from, 6) };
}

/** The range from the page's query, or the current week when it is missing, invalid, backwards or over 92 days. */
export function chooseRange(
  from: unknown,
  to: unknown,
  today: string,
): { from: string; to: string } {
  if (isDay(from) && isDay(to) && from <= to && to <= addDays(from, 92))
    return { from, to };
  return weekOf(today);
}
