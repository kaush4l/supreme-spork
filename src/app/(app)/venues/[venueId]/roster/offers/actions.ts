"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const refresh = (venueId: string) => {
  revalidatePath(`/venues/${venueId}/roster/offers`);
  revalidatePath(`/venues/${venueId}/roster`);
};

const filledAnswer = z.object({
  republished: z.boolean().optional(),
  needs_publish: z.boolean().optional(),
});

/** Give the shift to this person (`approve`) or say not this time. Approving fills the shift and may republish the week. */
export const decideClaim = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    offerId: z.string(),
    claimId: z.string(),
    approve: z.boolean(),
  }),
  async ({ venueId, key, offerId, claimId, approve }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/offers/{offer_id}/claims/{claim_id}/decide",
      {
        params: {
          path: { venue_id: venueId, offer_id: offerId, claim_id: claimId },
        },
        body: { approve },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    const a = filledAnswer.safeParse((data as { offer?: unknown })?.offer);
    return {
      approved: approve,
      republished: a.success ? (a.data.republished ?? false) : false,
      needsPublish: a.success ? (a.data.needs_publish ?? false) : false,
    };
  },
);

export const withdrawOffer = action(
  strictInput({ venueId: z.uuid(), key: z.string(), offerId: z.string() }),
  async ({ venueId, key, offerId }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/offers/{offer_id}/withdraw",
      {
        params: { path: { venue_id: venueId, offer_id: offerId } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    return { done: true };
  },
);
