import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { type Shift, shiftSchema } from "./me";

const base = (venueId: string) => ({ params: { path: { venue_id: venueId } } });

export const claimSchema = z.object({
  id: z.string(),
  staff_ref: z.string().optional(),
  name: z.string().optional(),
  /** null while the manager has not decided. */
  decision: z.string().nullable(),
  note: z.string().nullable().optional(),
  at: z.string().optional(),
});

export const offerSchema = z.object({
  id: z.string(),
  kind: z.string().optional(),
  /** `first_come` (taken at once) or a manager decides. */
  mode: z.string(),
  status: z.string(),
  shift: shiftSchema.extend({
    staff_name: z.string().nullable().optional(),
  }),
  offered_by: z.string().nullable().optional(),
  filled_by: z.string().nullable().optional(),
  created_at: z.string(),
  /** True when this offer is the caller's own dropped shift. */
  mine: z.boolean(),
  my_claim: claimSchema.nullable(),
  /** null (no claim), `waiting`, `got_it`, `not_this_time` or `offer_withdrawn`. */
  my_outcome: z.string().nullable().optional(),
});
export type Offer = z.infer<typeof offerSchema>;

/** My published shifts for the next 14 days (the backend's default window). */
export function myUpcomingShifts(
  accessToken: string,
  venueId: string,
  next: string,
): Promise<Shift[]> {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/me/shifts", base(venueId)),
    z.array(shiftSchema),
    next,
  );
}

/** Open offers, plus the ones I asked for that were settled in the last 7 days (so the outcome survives a refresh). */
export function myOffers(accessToken: string, venueId: string, next: string) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/me/offers", {
      params: {
        path: { venue_id: venueId },
        query: { decided_within_days: 7 },
      },
    }),
    z.array(offerSchema),
    next,
  );
}
