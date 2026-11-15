import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { staffSchema } from "./team";

const certSide = z.object({
  number: z.string().nullable(),
  expires_on: z.string(),
});

/** One certificate kind with the status the backend sends: checked, changed, unchecked or venue_only. */
export const certificateSchema = z.object({
  kind: z.string(),
  status: z.string(),
  venue: certSide.extend({ checked: z.boolean() }).nullable(),
  person: certSide.extend({ source: z.string().optional() }).nullable(),
});
export type Certificate = z.infer<typeof certificateSchema>;

export const availabilityRowSchema = z.object({
  id: z.string(),
  kind: z.string(),
  weekday: z.number().nullable().optional(),
  from_time: z.string().nullable().optional(),
  to_time: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  available: z.boolean(),
  note: z.string().nullable().optional(),
});
export type AvailabilityRow = z.infer<typeof availabilityRowSchema>;

const availabilitySchema = z.object({
  owner: z.string(),
  items: z.array(availabilityRowSchema),
});

export const unlinkedSchema = z.object({
  staff_ref: z.string(),
  name: z.string(),
  positions: z.array(z.string()),
  hourly_cost_cents: z.number().nullable(),
  shifts: z.number(),
});
export type Unlinked = z.infer<typeof unlinkedSchema>;

export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  active: z.boolean(),
  members: z.array(
    z.object({
      staff_id: z.string(),
      staff_ref: z.string(),
      name: z.string(),
      active: z.boolean(),
    }),
  ),
});
export type Group = z.infer<typeof groupSchema>;

export const blackoutSchema = z.object({
  id: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  reason: z.string(),
});
export type Blackout = z.infer<typeof blackoutSchema>;

const venue = (venueId: string) => ({ path: { venue_id: venueId } });

/** One person's profile (needs `staff.manage`). */
export function getStaffPerson(
  token: string,
  venueId: string,
  staffId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/staff/{staff_id}", {
      params: { path: { venue_id: venueId, staff_id: staffId } },
    }),
    staffSchema,
    next,
  );
}

/** Needs `certificates.record`. */
export function listCertificates(
  token: string,
  venueId: string,
  staffId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/staff/{staff_id}/certificates", {
      params: { path: { venue_id: venueId, staff_id: staffId } },
    }),
    z.array(certificateSchema),
    next,
  );
}

/** Needs `roster.build`. `owner` is "person" (their own rows) or "venue" (entered by a manager). */
export function getAvailability(
  token: string,
  venueId: string,
  staffId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/staff/{staff_id}/availability", {
      params: { path: { venue_id: venueId, staff_id: staffId } },
    }),
    availabilitySchema,
    next,
  );
}

export function listUnlinked(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/staff/unlinked", {
      params: venue(venueId),
    }),
    z.array(unlinkedSchema),
    next,
  );
}

export function listGroups(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/roster/groups", {
      params: { path: { venue_id: venueId }, query: { retired: false } },
    }),
    z.object({ items: z.array(groupSchema) }).transform((p) => p.items),
    next,
  );
}

export function listBlackouts(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/roster/blackouts", {
      params: venue(venueId),
    }),
    z.object({ items: z.array(blackoutSchema) }).transform((p) => p.items),
    next,
  );
}
