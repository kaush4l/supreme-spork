/** Backend request statuses in plain words. */
export const REQUEST_WORDS: Record<string, string> = {
  pending: "Waiting for your manager",
  approved: "Approved",
  rejected: "Not approved",
  expired: "Ran out of time",
  cancelled: "Cancelled",
};

export const KIND_WORDS: Record<string, string> = {
  leave: "Leave",
  swap: "Shift swap",
};

export const requestWord = (status: string): string =>
  REQUEST_WORDS[status] ?? status;

/** A date with no time (`2026-11-20`) written for people. It is not a moment, so no time zone shift is wanted. */
export function formatDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${ymd}T00:00:00Z`));
}

export function formatDateSpan(start: string, end: string): string {
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} to ${formatDate(end)}`;
}

/** The shape the date picker uses for a date. */
export type IsoDay =
  `${number}${number}${number}${number}-${number}${number}-${number}${number}`;
