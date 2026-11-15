"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

/** Add a category. The API makes its name from the label; a taken one is its 409 `category_exists`. */
export const addCategory = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    label: z.string().trim().min(1).max(100),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/categories",
      {
        params: { path: { venue_id: input.venueId } },
        body: { label: input.label },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bank/categories`);
    return { done: true };
  },
);

/** Relabel a category, or switch it off or on. Only what changes is sent. */
export const changeCategory = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    name: z.string().min(1).max(100),
    label: z.string().trim().min(1).max(100).optional(),
    active: z.boolean().optional(),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/categories/{name}",
      {
        params: { path: { venue_id: input.venueId, name: input.name } },
        body: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bank/categories`);
    return { done: true };
  },
);
