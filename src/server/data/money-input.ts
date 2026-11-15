/**
 * Turning what a manager types into the cents the backend wants, and back for an edit form. Pure text handling: no
 * pay is ever worked out here, only a typed rate is carried across.
 */

/** "28", "28.5", "$28.50" become cents; blank is `null` (nothing typed); anything else is `"invalid"`. */
export function dollarsToCents(text: string): number | null | "invalid" {
  const clean = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (clean === "") return null;
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return "invalid";
  const cents = (match[2] ?? "").padEnd(2, "0");
  return Number(match[1]) * 100 + Number(cents);
}

/** Cents as the text to put back in an edit box: 2850 becomes "28.50". */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const whole = Math.floor(cents / 100);
  return `${whole}.${String(cents % 100).padStart(2, "0")}`;
}
