/** True for a real calendar day written like 2026-11-16. Only checks the text; no date rule lives here. */
export function isDay(text: string | null | undefined): text is string {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** A `from`/`to` pair from the address bar: both must be real days, otherwise the API's own default range is used. */
export function pickRange(
  from: string | undefined,
  to: string | undefined,
): { from?: string; to?: string } {
  return isDay(from) && isDay(to) && from <= to ? { from, to } : {};
}
