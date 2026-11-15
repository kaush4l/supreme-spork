import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const requestSchema = z.object({
  id: z.string(),
  kind: z.enum(["leave", "swap"]),
  status: z.string(),
  description: z.string(),
  staff_ref: z.string().nullable().optional(),
  staff_name: z.string().nullable().optional(),
  details: z
    .object({
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      reason: z.string().nullable().optional(),
      to_staff_name: z.string().optional(),
      position: z.string().nullable().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .loose(),
  note: z.string().nullable().optional(),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
  /** Who decided it; null while pending or expired. */
  decided_by_name: z.string().nullable().optional(),
});
export type ApprovalRequest = z.infer<typeof requestSchema>;

export const claimSchema = z.object({
  id: z.string(),
  staff_ref: z.string(),
  name: z.string(),
  decision: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  at: z.string(),
});

export const offerSchema = z.object({
  id: z.string(),
  kind: z.string(),
  mode: z.string().optional(),
  status: z.string(),
  shift: z.object({
    external_id: z.string(),
    position: z.string().nullable().optional(),
    start: z.string(),
    end: z.string(),
    staff_name: z.string().nullable().optional(),
  }),
  offered_by: z.string().nullable().optional(),
  created_at: z.string(),
  claims: z.array(claimSchema),
});
export type PoolOffer = z.infer<typeof offerSchema>;

/** Leave and swap requests waiting for a decision. */
export function pendingRequests(
  accessToken: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/requests", {
      params: {
        path: { venue_id: venueId },
        query: { status: "pending", limit: 100 },
      },
    }),
    z.object({ items: z.array(requestSchema) }).transform((p) => p.items),
    next,
  );
}

/** Open shift-pool offers with the people who asked for each. */
export function openOffers(accessToken: string, venueId: string, next: string) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster/offers", {
      params: { path: { venue_id: venueId } },
    }),
    z.object({ items: z.array(offerSchema) }).transform((p) => p.items),
    next,
  );
}

/** Offers that were filled or withdrawn, with when and by whom (`decided_by_name` is null for a first-come fill). */
export const settledOfferSchema = offerSchema.extend({
  filled_by: z.string().nullable().optional(),
  decided_at: z.string(),
  decided_by_name: z.string().nullable().optional(),
});
export type SettledOffer = z.infer<typeof settledOfferSchema>;

/** Leave and swap requests decided in the last `days` days, newest decision first. */
export function decidedRequests(
  accessToken: string,
  venueId: string,
  days: number,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/requests", {
      params: {
        path: { venue_id: venueId },
        query: { decided_within_days: days, limit: 100 },
      },
    }),
    z.object({ items: z.array(requestSchema) }).transform((p) => p.items),
    next,
  );
}

/** Shift offers filled or withdrawn in the last `days` days, newest first. */
export function settledOffers(
  accessToken: string,
  venueId: string,
  days: number,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster/offers", {
      params: {
        path: { venue_id: venueId },
        query: { decided_within_days: days },
      },
    }),
    z.object({ items: z.array(settledOfferSchema) }).transform((p) => p.items),
    next,
  );
}
