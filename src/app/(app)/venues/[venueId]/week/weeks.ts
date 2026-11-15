/** Which week the findings list opens on and which weeks sit either side. Days are plain `YYYY-MM-DD` strings, compared as text; the API says which weeks exist. */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type FindingWeek = { week_start: string; count: number };

export function isDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DAY.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === value;
}

/** A day from the address when it is a real date, else nothing. */
export function chooseDay(value: string | undefined): string | undefined {
  return isDay(value) ? value : undefined;
}

/** The week to show: the one in the address, else the current week when it has findings, else the newest week with findings. */
export function chooseWeek(
  addressWeek: string | undefined,
  currentWeek: string,
  weeks: FindingWeek[],
): string | undefined {
  if (addressWeek) return addressWeek;
  if (weeks.some((w) => w.week_start === currentWeek && w.count > 0))
    return currentWeek;
  return weeks.map((w) => w.week_start).sort()[weeks.length - 1];
}

/** The nearest listed weeks before and after `shown` (which need not be in the list). */
export function neighbourWeeks(
  weeks: FindingWeek[],
  shown: string,
): { previous?: string; next?: string } {
  const all = weeks.map((w) => w.week_start).sort();
  return {
    previous: all.filter((w) => w < shown).pop(),
    next: all.find((w) => w > shown),
  };
}
