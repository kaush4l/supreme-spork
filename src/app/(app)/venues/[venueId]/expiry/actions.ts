"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const answer = z.object({ id: z.string() });

export const addExpiryItem = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    kind: z.string().min(1).max(60),
    staffRef: z.string().max(100).optional(),
    title: z.string().trim().min(1).max(200),
    reference: z.string().max(200).optional(),
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    warnDays: z.number().int().min(1).max(365).optional(),
    note: z.string().max(500).optional(),
    documentId: z.string().max(100).optional(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/expiry-items",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          kind: input.kind,
          staff_ref: input.staffRef || null,
          title: input.title,
          reference: input.reference || null,
          expires_on: input.expiresOn,
          warn_days: input.warnDays ?? null,
          note: input.note || null,
          document_id: input.documentId || null,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/expiry`);
    return { id: answer.parse(data).id };
  },
);
