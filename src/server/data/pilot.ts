import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { toApiFailure } from "../api/errors";

const countSchema = z.object({
  numerator: z.number(),
  denominator: z.number(),
});

const measureSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** A percent the backend worked out, or null when there is nothing to measure yet. */
  value: z.number().nullable(),
  numerator: z.number().nullable(),
  denominator: z.number().nullable(),
  pass_mark: z.number().nullable(),
  /** met, not_met, not_enough_data, reported or tracked_outside_app. */
  status: z.string(),
  basis: z.string(),
});
export type PilotMeasure = z.infer<typeof measureSchema>;

/** One week: its Monday plus a count for each measure that has weekly figures (keyed by the measure's key). */
const weekSchema = z
  .looseObject({ week_start: z.string() })
  .transform(({ week_start, ...rest }) => {
    const counts: Record<string, z.infer<typeof countSchema> | null> = {};
    for (const [key, value] of Object.entries(rest)) {
      const parsed = countSchema.safeParse(value);
      counts[key] = parsed.success ? parsed.data : null;
    }
    return { week_start, counts };
  });
export type PilotWeek = z.infer<typeof weekSchema>;

export const scorecardSchema = z.object({
  period: z.object({
    from: z.string().nullable(),
    to: z.string().nullable(),
    weeks: z.number(),
  }),
  measures: z.array(measureSchema),
  weeks: z.array(weekSchema),
});
export type Scorecard = z.infer<typeof scorecardSchema>;

export type ScorecardResult =
  | { ok: true; scorecard: Scorecard }
  | { ok: false; message: string };

const RANGE_CODES = new Set(["bad_date", "bad_range", "range_too_long"]);

/** The pilot scorecard. With no dates the backend picks the period; a range it refuses comes back as its sentence. */
export async function fetchScorecard(
  token: string,
  venueId: string,
  range: { from?: string; to?: string },
  next: string,
): Promise<ScorecardResult> {
  const answer = await backend(token).GET(
    "/v1/venues/{venue_id}/pilot/scorecard",
    {
      params: {
        path: { venue_id: venueId },
        query: {
          ...(range.from ? { from: range.from } : {}),
          ...(range.to ? { to: range.to } : {}),
        },
      },
    },
  );
  if (answer.response.status === 422) {
    const failure = toApiFailure(422, answer.error);
    if (RANGE_CODES.has(failure.code))
      return { ok: false, message: failure.message };
  }
  return {
    ok: true,
    scorecard: await read(Promise.resolve(answer), scorecardSchema, next),
  };
}
