"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const answer = z.object({ id: z.string() });

/** Edit a supplier. The answer carries a NEW id: the page goes there. A 409 means someone changed it first. */
export const changeSupplier = action(
  strictInput({
    venueId: z.uuid(),
    supplierId: z.uuid(),
    key: z.string(),
    name: z.string().trim().min(1).max(200),
    aliases: z.array(z.string().max(200)).max(50),
    category: z.string().max(100).nullable(),
    paymentTermsDays: z.number().int().min(0).max(365).nullable(),
    confirmed: z.boolean().optional(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/suppliers/{supplier_id}",
      {
        params: {
          path: { venue_id: input.venueId, supplier_id: input.supplierId },
        },
        body: {
          name: input.name,
          aliases: input.aliases,
          category: input.category,
          payment_terms_days: input.paymentTermsDays,
          ...(input.confirmed ? { confirmed: true } : {}),
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok) {
      const failure = toApiFailure(response.status, error);
      throw failure;
    }
    revalidatePath(`/venues/${input.venueId}/suppliers`);
    return { id: answer.parse(data).id };
  },
);
