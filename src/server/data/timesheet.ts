import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const lineSchema = z.object({
  /** The clock-in and clock-out entries behind this line (clock_out_id is null while unfinished). */
  clock_in_id: z.string().nullish(),
  clock_out_id: z.string().nullish(),
  staff_ref: z.string(),
  name: z.string(),
  position: z.string().nullish(),
  date: z.string(),
  clock_in: z.string(),
  clock_out: z.string().nullable(),
  break_minutes: z.number(),
  rostered: z.boolean().optional(),
  hours: z.number().nullable(),
  rate_cents: z.number().nullish(),
  cost_cents: z.number().nullish(),
  complete: z.boolean(),
});
export type TimesheetLine = z.infer<typeof lineSchema>;

export const personSchema = z.object({
  staff_ref: z.string(),
  name: z.string(),
  sessions: z.number(),
  incomplete: z.number(),
  hours: z.number(),
  cost_cents: z.number().nullish(),
});

export const timesheetSchema = z.object({
  from: z.string(),
  to: z.string(),
  lines: z.array(lineSchema),
  people: z.array(personSchema),
});
export type Timesheet = z.infer<typeof timesheetSchema>;

export function fetchTimesheet(
  accessToken: string,
  venueId: string,
  from: string,
  to: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/timesheet", {
      params: { path: { venue_id: venueId }, query: { from, to } },
    }),
    timesheetSchema,
    next,
  );
}

export const staffOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
});

/** Active people, for the "add a missing entry" form. */
export function staffOptions(
  accessToken: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/staff", {
      params: {
        path: { venue_id: venueId },
        query: { active: true, limit: 200 },
      },
    }),
    z.object({ items: z.array(staffOptionSchema) }).transform((p) => p.items),
    next,
  );
}
