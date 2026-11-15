"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const place = {
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy_m: z.number().min(0).max(100000).optional(),
};

/** Clock in. At a venue that checks where the phone is, the browser sends its position; the backend decides. */
export const clockIn = action(
  strictInput({ venueId: z.uuid(), key: z.string(), ...place }),
  async ({ venueId, key, ...where }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/clock-in",
      {
        params: { path: { venue_id: venueId } },
        body: where,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/today`);
    const answer = data as { flagged?: boolean; unplanned?: boolean };
    return {
      flagged: answer.flagged === true,
      unplanned: answer.unplanned === true,
    };
  },
);

export const clockOut = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    breakMinutes: z.number().int().min(0).max(240),
  }),
  async ({ venueId, key, breakMinutes }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/clock-out",
      {
        params: { path: { venue_id: venueId } },
        body: { break_minutes: breakMinutes },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/today`);
    return { done: true };
  },
);
