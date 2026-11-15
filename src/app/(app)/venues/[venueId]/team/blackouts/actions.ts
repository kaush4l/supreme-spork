"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const addBlackout = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    startDate: day,
    endDate: day,
    reason: z.string().trim().min(1).max(200),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/blackouts",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          start_date: input.startDate,
          end_date: input.endDate,
          reason: input.reason,
        } as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/team/blackouts`);
    return { done: true };
  },
);

export const removeBlackout = action(
  strictInput({ venueId: z.uuid(), blackoutId: z.string().min(1) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/blackouts/{blackout_id}/remove",
      {
        params: {
          path: { venue_id: input.venueId, blackout_id: input.blackoutId },
        },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/team/blackouts`);
    return { done: true };
  },
);
