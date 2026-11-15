"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const ids = { venueId: z.uuid(), documentId: z.uuid(), key: z.string() };
const done = (venueId: string, documentId: string) => {
  revalidatePath(`/venues/${venueId}/bank/files/${documentId}`);
  revalidatePath(`/venues/${venueId}/bank/files`);
  return { done: true };
};

export const approveFile = action(
  strictInput({ ...ids, note: z.string().trim().max(500).optional() }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bank-files/{document_id}/approve",
      {
        params: {
          path: { venue_id: input.venueId, document_id: input.documentId },
        },
        body: { note: input.note || null },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    return done(input.venueId, input.documentId);
  },
);

/** A reason is required; the API says so too. */
export const rejectFile = action(
  strictInput({ ...ids, reason: z.string().trim().min(1).max(500) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bank-files/{document_id}/reject",
      {
        params: {
          path: { venue_id: input.venueId, document_id: input.documentId },
        },
        body: { reason: input.reason },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    return done(input.venueId, input.documentId);
  },
);

export const reparseFile = action(
  strictInput(ids),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bank-files/{document_id}/reparse",
      {
        params: {
          path: { venue_id: input.venueId, document_id: input.documentId },
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    return done(input.venueId, input.documentId);
  },
);
