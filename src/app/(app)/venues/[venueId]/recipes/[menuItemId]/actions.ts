"use server";

import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { recipeSavedSchema } from "@/server/data/recipes";

/** A decimal typed by a person: digits with an optional fraction. The backend checks the range. */
const decimal = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/);

/** Set how much of one ingredient goes in. 0 removes it. The answer is the dish as the API returns it. */
export const saveLine = action(
  strictInput({
    venueId: z.uuid(),
    menuItemId: z.uuid(),
    ingredientId: z.uuid(),
    key: z.string(),
    qty: decimal,
    unit: z.string().trim().min(1).max(40),
    usablePct: decimal.optional(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).PUT(
      "/v1/venues/{venue_id}/recipes/{menu_item_id}/lines/{ingredient_id}",
      {
        params: {
          path: {
            venue_id: input.venueId,
            menu_item_id: input.menuItemId,
            ingredient_id: input.ingredientId,
          },
        },
        body: {
          qty_per_serve: input.qty,
          unit: input.unit,
          ...(input.usablePct ? { usable_pct: input.usablePct } : {}),
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    return recipeSavedSchema.parse(data);
  },
);

/** Set how many portions the recipe makes. */
export const saveYield = action(
  strictInput({
    venueId: z.uuid(),
    menuItemId: z.uuid(),
    key: z.string(),
    portions: decimal,
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).PUT(
      "/v1/venues/{venue_id}/recipes/{menu_item_id}/yield",
      {
        params: {
          path: { venue_id: input.venueId, menu_item_id: input.menuItemId },
        },
        body: { portions: input.portions },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    return recipeSavedSchema.parse(data);
  },
);
