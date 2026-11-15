"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const answer = z.object({ id: z.string() });

export const addSupplier = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    name: z.string().trim().min(1).max(200),
    aliases: z.array(z.string().max(200)).max(50),
    category: z.string().max(100).optional(),
    paymentTermsDays: z.number().int().min(0).max(365).optional(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/suppliers",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          name: input.name,
          aliases: input.aliases,
          category: input.category || null,
          payment_terms_days: input.paymentTermsDays ?? null,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/suppliers`);
    return { id: answer.parse(data).id };
  },
);
