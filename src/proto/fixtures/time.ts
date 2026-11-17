/** Fixed reference time for all fixtures. Never call Date.now() in fixtures. */
export const REFERENCE_NOW = "2026-11-17T10:30:00+11:00";
export const REFERENCE_TZ = "Australia/Sydney";
/** Local trading date at REFERENCE_NOW (Tuesday). */
export const REFERENCE_DATE = "2026-11-17";

const DAY_MS = 86_400_000;

function parseYmd(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y as number, (m as number) - 1, d as number);
}
function toYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Add whole days to a YYYY-MM-DD string (calendar arithmetic, no timezone). */
export function addDays(ymd: string, days: number): string {
  return toYmd(parseYmd(ymd) + days * DAY_MS);
}

/** Monday of the week containing the given YYYY-MM-DD (or local ISO). */
export function startOfWeek(ymd: string): string {
  const ms = parseYmd(ymd);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  const back = (dow + 6) % 7;
  return toYmd(ms - back * DAY_MS);
}

/** Whole days between two YYYY-MM-DD strings (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseYmd(b) - parseYmd(a)) / DAY_MS);
}

/** Format an absolute instant (ISO with offset) in a timezone, e.g. "Tue 17 Nov, 10:30 am". */
export function formatLocal(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** Local YYYY-MM-DD of an instant in a timezone. */
export function localDate(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return parts;
}

/** Offset string for a venue timezone at the reference date (fixture-only; no DST in Nov for Perth). */
export function offsetFor(tz: string): string {
  return tz === "Australia/Perth" ? "+08:00" : "+11:00";
}

/** Reference instant expressed in the venue's own timezone offset. */
export function referenceNowFor(tz: string): string {
  return tz === "Australia/Perth" ? "2026-11-17T07:30:00+08:00" : REFERENCE_NOW;
}

/** ISO timestamp N days / minutes before REFERENCE_NOW (Sydney offset). */
export function agoIso(opts: { days?: number; minutes?: number }): string {
  const ms =
    new Date(REFERENCE_NOW).getTime() -
    (opts.days ?? 0) * DAY_MS -
    (opts.minutes ?? 0) * 60_000;
  const d = new Date(ms + 11 * 3_600_000);
  return `${d.toISOString().slice(0, 19)}+11:00`;
}

/** Local wall-clock "YYYY-MM-DDTHH:mm" (no offset) from date + hh:mm. */
export function wall(ymd: string, hhmm: string): string {
  return `${ymd}T${hhmm}`;
}

/** Hours between two local wall-clock strings (no offset). */
export function wallHours(start: string, end: string): number {
  const p = (s: string) => {
    const [d, t] = s.split("T");
    const [h, m] = (t as string).split(":").map(Number);
    return (
      parseYmd(d as string) + ((h as number) * 60 + (m as number)) * 60_000
    );
  };
  return (p(end) - p(start)) / 3_600_000;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** The one prototype date format: "2026-11-17" -> "Tue 17 Nov 2026". Calendar arithmetic only, no timezone. */
export function formatDate(ymd: string): string {
  const ms = parseYmd(ymd);
  const dt = new Date(ms);
  return `${DOW[dt.getUTCDay()]} ${dt.getUTCDate()} ${MON[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

/** The one "Updated" stamp: "Updated 10:30 am Tue 17 Nov", from REFERENCE_NOW in the venue timezone. */
export function formatUpdated(tz: string = REFERENCE_TZ): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(REFERENCE_NOW));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `Updated ${g("hour")}:${g("minute")} ${g("dayPeriod").toLowerCase()} ${g("weekday")} ${g("day")} ${g("month")}`;
}
