import type { Metric } from "../../types";

/** Display formatting only: integer cents -> "$48,125.00". Never used to compute a business total. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rem = (abs % 100).toString().padStart(2, "0");
  return `${sign}$${dollars}.${rem}`;
}

/** Missing (null) is always the word "Missing", never 0. */
export function formatMetricValue(m: Pick<Metric, "value" | "unit">): string {
  if (m.value === null) return "Missing";
  switch (m.unit) {
    case "cents":
      return formatCents(m.value);
    case "hours":
      return `${m.value} hours`;
    case "percent":
      return `${m.value}%`;
    default:
      return String(m.value);
  }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
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

/** "2026-11-17T22:00" -> "10:00 pm". Wall-clock strings are never converted between timezones. */
export function fmtWallTime(wall: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(wall);
  if (!m) return wall;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** "2026-11-17..." -> "Tue 17 Nov". */
export function fmtWallDay(wall: string): string {
  const [y, mo, d] = wall.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y as number, (mo as number) - 1, d as number));
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[(mo as number) - 1]}`;
}

/** "Tue 17 Nov, 10:00 pm to 6:00 am Wed 18 Nov" when the shift crosses midnight. */
export function fmtShiftRange(start: string, end: string): string {
  const sameDay = start.slice(0, 10) === end.slice(0, 10);
  return sameDay
    ? `${fmtWallDay(start)}, ${fmtWallTime(start)} to ${fmtWallTime(end)}`
    : `${fmtWallDay(start)}, ${fmtWallTime(start)} to ${fmtWallTime(end)} ${fmtWallDay(end)}`;
}
