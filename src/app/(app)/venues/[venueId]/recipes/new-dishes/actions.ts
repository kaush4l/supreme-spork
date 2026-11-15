"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

/** This is a real dish on the menu. */
export const confirmDish = action(
  strictInput({ venueId: z.uuid(), itemId: z.uuid(), key: z.string() }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/menu-items/{item_id}/confirm",
      {
        params: { path: { venue_id: input.venueId, item_id: input.itemId } },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/recipes`);
    return { done: true };
  },
);

const movedSchema = z.object({
  moved: z.object({ aliases: z.number(), sales: z.number() }).optional(),
  already_done: z.boolean().optional(),
});

/** This dish is another spelling of `intoId`: its sales move there. The page asks first. */
export const mergeDish = action(
  strictInput({
    venueId: z.uuid(),
    itemId: z.uuid(),
    intoId: z.uuid(),
    key: z.string(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/menu-items/{item_id}/merge",
      {
        params: { path: { venue_id: input.venueId, item_id: input.itemId } },
        body: { into_item_id: input.intoId },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/recipes`);
    return movedSchema.parse(data);
  },
);
