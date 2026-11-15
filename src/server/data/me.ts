import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const rightsSchema = z.object({
  venue_id: z.string(),
  roles: z.array(z.string()),
  rights: z.array(z.string()),
  approval_limit_cents: z.number(),
  /** On this venue's team (an active staff profile): only then are the shift pages worth showing. */
  has_staff_profile: z.boolean().optional(),
});

/** The signed-in person's roles and rights at one venue. */
export function myRights(accessToken: string, venueId: string, next: string) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/me/rights", {
      params: { path: { venue_id: venueId } },
    }),
    rightsSchema,
    next,
  );
}

export const shiftSchema = z.object({
  external_id: z.string(),
  status: z.string(),
  position: z.string().nullable(),
  start: z.string(),
  end: z.string(),
  break_minutes: z.number(),
  hours: z.number().nullable().optional(),
});
export type Shift = z.infer<typeof shiftSchema>;

export const clockSchema = z.object({
  clocked_in: z.boolean(),
  since: z.string().nullable(),
  unplanned: z.boolean(),
  shift: shiftSchema.nullable(),
  method: z.string(),
});

export const myListSchema = z.object({
  id: z.string(),
  name: z.string(),
  trading_day: z.string(),
  due_at: z.string(),
  status: z.enum(["open", "overdue", "missed", "done"]),
  completed_at: z.string().nullable().optional(),
});
export type MyList = z.infer<typeof myListSchema>;

const base = (venueId: string) => ({ params: { path: { venue_id: venueId } } });

export function myClock(accessToken: string, venueId: string, next: string) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/me/clock", base(venueId)),
    clockSchema,
    next,
  );
}

export function myShifts(accessToken: string, venueId: string, next: string) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/me/shifts", base(venueId)),
    z.array(shiftSchema),
    next,
  );
}

export function myLists(accessToken: string, venueId: string, next: string) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/workflows/me/lists",
      // the backend answers 50 at a time; without this a person with more lists never saw the later ones
      { params: { path: { venue_id: venueId }, query: { limit: 200 } } },
    ),
    z.object({ items: z.array(myListSchema) }).transform((page) => page.items),
    next,
  );
}
