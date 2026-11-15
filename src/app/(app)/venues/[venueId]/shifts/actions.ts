"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const input = {
  venueId: z.uuid(),
  id: z.string().min(1).max(100),
  key: z.string(),
};

const path = (venueId: string) => `/venues/${venueId}/shifts`;

/** "Can't work it": put one of my published shifts in the pool. It stays mine until the manager picks someone. */
export const dropShift = action(
  strictInput(input),
  async ({ venueId, id, key }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/shifts/{external_id}/drop",
      {
        params: { path: { venue_id: venueId, external_id: id } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(path(venueId));
    revalidatePath(`/venues/${venueId}/today`);
    return { done: true };
  },
);

const claimAnswer = z.object({
  offer: z.object({ status: z.string() }).loose(),
});

/** Claim an offered shift. `taken` is true when the venue gives it at once; otherwise the manager decides. */
export const claimOffer = action(
  strictInput(input),
  async ({ venueId, id, key }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/offers/{offer_id}/claim",
      {
        params: { path: { venue_id: venueId, offer_id: id } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(path(venueId));
    revalidatePath(`/venues/${venueId}/today`);
    const parsed = claimAnswer.safeParse(data);
    return { taken: parsed.success && parsed.data.offer.status === "filled" };
  },
);

/** Take my own dropped shift back off the pool. */
export const withdrawOffer = action(
  strictInput(input),
  async ({ venueId, id }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/offers/{offer_id}/withdraw",
      { params: { path: { venue_id: venueId, offer_id: id } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(path(venueId));
    return { done: true };
  },
);

/** Take back my own request for an offered shift while nobody has decided it. */
export const withdrawClaim = action(
  strictInput(input),
  async ({ venueId, id }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/offers/{offer_id}/claim/withdraw",
      { params: { path: { venue_id: venueId, offer_id: id } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(path(venueId));
    return { done: true };
  },
);
