import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** One thing to look at before a pay run (N31). Minutes are whole minutes as the API sends them. */
export const exceptionSchema = z.object({
  key: z.string(),
  kind: z.string(),
  staff_ref: z.string(),
  name: z.string(),
  date: z.string(),
  shift_id: z.string().nullable(),
  clock_in_id: z.string().nullable(),
  clock_out_id: z.string().nullable(),
  planned_minutes: z.number(),
  actual_minutes: z.number().nullable(),
  difference_minutes: z.number().nullable(),
  text: z.string(),
  dismissed: z.boolean(),
  dismissed_reason: z.string().nullable(),
});
export type TimeException = z.infer<typeof exceptionSchema>;

export const exceptionsSchema = z.object({
  from: z.string(),
  to: z.string(),
  tolerance_minutes: z.number(),
  exceptions: z.array(exceptionSchema),
  people: z.array(
    z.object({
      staff_ref: z.string(),
      name: z.string(),
      planned_minutes: z.number(),
      actual_minutes: z.number(),
      open_exceptions: z.number(),
    }),
  ),
  /** Open exceptions per kind (set-aside ones are not counted). */
  counts: z.record(z.string(), z.number()),
  open_count: z.number(),
  dismissed_count: z.number(),
  ready: z.boolean(),
});
export type TimeCheck = z.infer<typeof exceptionsSchema>;

export const reviewSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  note: z.string(),
  open_count: z.number(),
  counts: z.record(z.string(), z.number()),
  tolerance_minutes: z.number(),
  created_by: z.string().nullable(),
  created_by_name: z.string().nullable(),
  created_at: z.string(),
});
export type Review = z.infer<typeof reviewSchema>;

export const reviewsSchema = z.object({
  items: z.array(reviewSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

/** The exceptions for trading days `from`..`to` (at most 92 days). Needs the timesheet.view right. */
export function fetchTimeCheck(
  token: string,
  venueId: string,
  from: string,
  to: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/timesheet/exceptions", {
      params: { path: { venue_id: venueId }, query: { from, to } },
    }),
    exceptionsSchema,
    next,
  );
}

/** Earlier checks, newest first. */
export function fetchReviews(
  token: string,
  venueId: string,
  limit: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/timesheet/reviews", {
      params: { path: { venue_id: venueId }, query: { limit, offset: 0 } },
    }),
    reviewsSchema,
    next,
  );
}
