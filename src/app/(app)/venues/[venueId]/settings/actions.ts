"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

/** Change roster rules. A number becomes a rule's setting; `null` puts a rule back to its default. */
export const saveRosterRules = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    rules: z.record(
      z.string().max(80),
      z.union([z.string().max(40), z.number(), z.boolean(), z.null()]),
    ),
  }),
  async ({ venueId, key, rules }, principal) => {
    if (Object.keys(rules).length === 0) return { done: true }; // nothing differs from what is saved
    const { error, response } = await backend(principal.accessToken).PATCH(
      "/v1/venues/{venue_id}/roster/rules",
      {
        params: { path: { venue_id: venueId } },
        body: { rules } as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/settings`);
    return { done: true };
  },
);

/** Set where the venue is, from the position the owner's browser reads. The backend checks the ranges. */
export const saveLocation = action(
  strictInput({
    venueId: z.uuid(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  async ({ venueId, latitude, longitude }, principal) => {
    const { error, response } = await backend(principal.accessToken).PUT(
      "/v1/venues/{venue_id}/roster/clock/location",
      {
        params: { path: { venue_id: venueId } },
        body: { latitude, longitude },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/settings`);
    return { done: true };
  },
);
