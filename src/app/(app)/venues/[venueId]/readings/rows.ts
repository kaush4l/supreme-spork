import { formatDay, formatTime } from "@/server/format";
import { followUpWords } from "../actions/words";

/** The parts of one reading the table shows (the backend's row, as the data reader checks it). */
export type ReadingIn = {
  trading_day: string;
  answered_at: string;
  list_id: string;
  list_name: string;
  item_key: string;
  label: string;
  value: number;
  min_value: number | null;
  max_value: number | null;
  out_of_range: boolean;
  answered_by_name?: string | null;
  corrective_action_id?: string | null;
  corrective_action_state?: string | null;
};

/** One table row, every cell already words. */
export type ReadingRow = {
  id: string;
  day: string;
  time: string;
  check: string;
  reading: string;
  allowed: string;
  result: string;
  by: string;
  /** The follow-up's state in words, empty when there is none. */
  followUp: string;
  /** Where that follow-up is, under the venue, or null. */
  followUpPath: string | null;
};

/** A number as people write it: no trailing zeros, at most 2 decimals. */
export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** What the item allows, in words. */
export function allowedText(min: number | null, max: number | null): string {
  if (min != null && max != null)
    return `${formatNumber(min)} to ${formatNumber(max)}`;
  if (max != null) return `up to ${formatNumber(max)}`;
  if (min != null) return `at least ${formatNumber(min)}`;
  return "no limit";
}

/** The word for the result; "Out of range" is spelled out so it reads on a black and white print. */
export function resultText(outOfRange: boolean): string {
  return outOfRange ? "Out of range" : "In range";
}

export function readingRow(r: ReadingIn, timeZone: string): ReadingRow {
  return {
    id: `${r.list_id}:${r.item_key}`,
    day: formatDay(`${r.trading_day}T12:00:00Z`, "UTC"),
    time: formatTime(r.answered_at, timeZone),
    check: `${r.label} (${r.list_name})`,
    reading: formatNumber(r.value),
    allowed: allowedText(r.min_value, r.max_value),
    result: resultText(r.out_of_range),
    by: r.answered_by_name?.trim() ? r.answered_by_name : "Not known",
    followUp: r.corrective_action_id
      ? followUpWords(r.corrective_action_state)
      : "",
    followUpPath: r.corrective_action_id
      ? `/actions/${r.corrective_action_id}`
      : null,
  };
}
