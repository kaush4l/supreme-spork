"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";

/** Mark one notice read. Doing it twice is harmless, so there is no key. */
export const markRead = action(
  strictInput({ venueId: z.uuid(), id: z.uuid() }),
  async ({ venueId, id }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/notifications/{notification_id}/read",
      { params: { path: { venue_id: venueId, notification_id: id } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/notices`);
    return { done: true };
  },
);
