"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

/** Say "I got this cash". Only the person paid can, once (409 `already_confirmed`); someone else's payment is 404. */
export const confirmCash = action(
  strictInput({
    venueId: z.uuid(),
    paymentId: z.uuid(),
    key: z.string(),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/cash-payments/{payment_id}/confirm",
      {
        params: {
          path: { venue_id: input.venueId, payment_id: input.paymentId },
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/my-cash`);
    return { done: true };
  },
);
