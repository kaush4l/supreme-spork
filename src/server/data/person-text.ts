/**
 * Plain words and small rules for the person's own pages (profile, certificates, work, availability, calendar link).
 * Pure, so it is tested without a browser. Nothing here decides anything the backend decides: it only words and
 * splits what the person typed or what the API sent.
 */

export const CERTIFICATE_KINDS = [
  { value: "rsa", label: "RSA (responsible service of alcohol)" },
  { value: "food_safety", label: "Food safety" },
  { value: "first_aid", label: "First aid" },
  { value: "other", label: "Other" },
] as const;

export type CertificateKind = (typeof CERTIFICATE_KINDS)[number]["value"];

export function kindLabel(kind: string): string {
  return CERTIFICATE_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/** Where a certificate came from, in words. The API marks one copied from an employer as `employer`. */
export function sourceLabel(source: string): string {
  if (source === "employer") return "Copied from a venue you work at";
  if (source === "self") return "Added by you";
  return "Added by you";
}

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const WEEKDAY_OPTIONS = WEEKDAYS.map((label, i) => ({
  value: String(i),
  label,
}));

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS[weekday] ?? "";
}

/** `2027-03-01` as `1 Mar 2027`, with no time zone shift (a date, not a moment). */
export function dayLabel(date: string | null | undefined): string {
  if (!date) return "";
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

/** `09:00:00` as `9:00 am`. */
export function timeLabel(time: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!m) return time ?? "";
  const hour = Number(m[1]);
  const suffix = hour >= 12 ? "pm" : "am";
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m[2]} ${suffix}`;
}

export type AvailabilityRowLike = {
  kind: string;
  weekday: number | null;
  from_time: string | null;
  to_time: string | null;
  start_date: string | null;
  end_date: string | null;
  available: boolean;
};

/** When a row applies, for example `Mondays, 9:00 am to 5:00 pm` or `1 Dec 2026 to 5 Dec 2026`. */
export function whenLabel(row: AvailabilityRowLike): string {
  if (row.kind === "weekly") {
    const day = row.weekday === null ? "" : `${weekdayLabel(row.weekday)}s`;
    return `${day}, ${timeLabel(row.from_time)} to ${timeLabel(row.to_time)}`;
  }
  const from = dayLabel(row.start_date);
  const to = dayLabel(row.end_date);
  return !to || to === from ? from : `${from} to ${to}`;
}

/** Skills typed as one line, split on commas and line breaks. The backend cleans and limits them again. */
export function splitSkills(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,\n]/)) {
    const skill = part.trim().replace(/\s+/g, " ");
    if (skill && !out.some((s) => s.toLowerCase() === skill.toLowerCase()))
      out.push(skill);
  }
  return out;
}

/** The whole calendar address: the API's address plus the path it sent when the link was made. */
export function calendarAddress(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Empty or blank text is cleared on the backend by sending null. */
export function blankToNull(text: string): string | null {
  const t = text.trim();
  return t === "" ? null : t;
}
