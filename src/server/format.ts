/** Showing times and money. The UI never works out a trading day or a total: it only formats what the backend sent. */

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** `9:00 am to 5:00 pm` */
export function formatSpan(
  start: string,
  end: string,
  timeZone: string,
): string {
  return `${formatTime(start, timeZone)} to ${formatTime(end, timeZone)}`;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

export function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/0$/, "")} h`;
}
