import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { claimSchema } from "./shifts";

/**
 * One offer as the person sees it, settled or not (`GET /me/offers/{id}`): what the notice they were sent opens.
 * `label` is the headline in the backend's own words; `can_claim` is true only while the offer is open and this
 * person may take it. A person who was never told about the offer gets 404 (the standard not-found page).
 */
export const myOfferSchema = z.object({
  id: z.string(),
  kind: z.string().optional(),
  mode: z.string(),
  shift: z
    .object({
      external_id: z.string().optional(),
      status: z.string().optional(),
      position: z.string().nullish(),
      start: z.string(),
      end: z.string(),
      day: z.string().nullish(),
      start_local: z.string().nullish(),
      end_local: z.string().nullish(),
      hours: z.number().nullish(),
    })
    .loose(),
  /** open, filled, withdrawn, shift_cancelled or started. */
  status: z.string(),
  my_outcome: z.string().nullish(),
  label: z.string(),
  settled_at: z.string().nullish(),
  can_claim: z.boolean(),
  mine: z.boolean(),
  offered_by: z.string().nullish(),
  my_claim: claimSchema.nullish(),
});
export type MyOffer = z.infer<typeof myOfferSchema>;

export function myOffer(
  accessToken: string,
  venueId: string,
  offerId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/me/offers/{offer_id}", {
      params: { path: { venue_id: venueId, offer_id: offerId } },
    }),
    myOfferSchema,
    next,
  );
}
