import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { toApiFailure } from "../api/errors";

export const readingSchema = z.object({
  trading_day: z.string(),
  answered_at: z.string(),
  list_id: z.string(),
  list_name: z.string(),
  item_key: z.string(),
  label: z.string(),
  value: z.number(),
  min_value: z.number().nullable(),
  max_value: z.number().nullable(),
  out_of_range: z.boolean(),
  answered_by: z.string().nullish(),
  answered_by_name: z.string().nullish(),
  staff_ref: z.string().nullish(),
  staff_name: z.string().nullish(),
  /** The follow-up raised by this reading going out of range, if any, and its state (open, done or cancelled). */
  corrective_action_id: z.string().nullish(),
  corrective_action_state: z.string().nullish(),
});
export type Reading = z.infer<typeof readingSchema>;

export const readingsSchema = z.object({
  from: z.string(),
  to: z.string(),
  total: z.number(),
  items: z.array(readingSchema),
});
export type Readings = z.infer<typeof readingsSchema>;

export type ReadingsResult =
  | { ok: true; readings: Readings }
  | { ok: false; message: string };

/** The reasons the backend refuses a range with a sentence meant for a person. */
const RANGE_CODES = new Set(["bad_date", "bad_range", "range_too_long"]);

/**
 * Every saved reading of a number item that has a range, for lists whose trading day is in `from` to `to`.
 * A range the backend refuses (bad date, backwards, over 31 days) comes back as its sentence, not an error page.
 */
export async function fetchReadings(
  accessToken: string,
  venueId: string,
  from: string,
  to: string,
  next: string,
): Promise<ReadingsResult> {
  const answer = await backend(accessToken).GET(
    "/v1/venues/{venue_id}/checklists/readings",
    { params: { path: { venue_id: venueId }, query: { from, to } } },
  );
  if (answer.response.status === 422) {
    const failure = toApiFailure(422, answer.error);
    if (RANGE_CODES.has(failure.code))
      return { ok: false, message: failure.message };
  }
  const readings = await read(Promise.resolve(answer), readingsSchema, next);
  return { ok: true, readings };
}
