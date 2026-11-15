"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Ask for leave. The backend refuses dates the venue has closed and says which. */
export const askLeave = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    startDate: day,
    endDate: day,
    reason: z.string().max(300),
  }),
  async ({ venueId, key, startDate, endDate, reason }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/requests/leave",
      {
        params: { path: { venue_id: venueId } },
        body: {
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim() || null,
        },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/requests`);
    return { done: true };
  },
);

/** Ask a colleague to take one of my published shifts. */
export const askSwap = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    shiftId: z.string().min(1).max(100),
    colleagueId: z.string().min(1).max(100),
    reason: z.string().max(300),
  }),
  async ({ venueId, key, shiftId, colleagueId, reason }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/requests/swap",
      {
        params: { path: { venue_id: venueId } },
        body: {
          shift_external_id: shiftId,
          with_staff_id: colleagueId,
          reason: reason.trim() || null,
        },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/requests`);
    return { done: true };
  },
);
