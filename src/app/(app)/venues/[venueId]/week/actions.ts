"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

/** Save a corrected version of a finished day (owner and partner; the backend decides). */
export const refreshDay = action(
  strictInput({
    venueId: z.uuid(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    key: z.string(),
  }),
  async ({ venueId, day, key }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/summary/{day}/refresh",
      {
        params: { path: { venue_id: venueId, day } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/week`);
    return { done: true };
  },
);
