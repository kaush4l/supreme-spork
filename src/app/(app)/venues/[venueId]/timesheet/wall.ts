/** `2026-11-16T17:30`: a moment as wall-clock date and time in the venue's time zone, for a form field. Formatting only. */
export function wallTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** True for `2026-11-16T17:30`. */
export function isWallTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
