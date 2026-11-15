import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const hoursSchema = z.object({
  from: z.string(),
  to: z.string(),
  /** null when no hourly rate is set for the person. */
  rate_cents: z.number().nullable(),
  lines: z.array(
    z.object({
      date: z.string(),
      clock_in: z.string(),
      clock_out: z.string().nullable(),
      break_minutes: z.number(),
      rostered: z.boolean(),
      hours: z.number().nullable(),
      estimated_cents: z.number().nullable(),
      complete: z.boolean(),
    }),
  ),
  incomplete: z.number(),
  hours: z.number(),
  estimated_cents: z.number().nullable(),
  basis: z.string(),
});
export type MyHours = z.infer<typeof hoursSchema>;

/** The caller's own worked hours. Without `from`/`to` the backend uses the last 14 days. */
export function myHours(
  accessToken: string,
  venueId: string,
  range: { from?: string; to?: string },
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/me/hours", {
      params: { path: { venue_id: venueId }, query: range },
    }),
    hoursSchema,
    next,
  );
}
