"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { fileLinkSchema } from "@/server/data/expiry";

const answer = z.object({ id: z.string() });
const ids = { venueId: z.uuid(), itemId: z.uuid(), key: z.string() };

/** Renew or correct: only the fields that changed are sent. The answer carries a NEW id. */
export const changeExpiryItem = action(
  strictInput({
    ...ids,
    title: z.string().trim().min(1).max(200).optional(),
    reference: z.string().max(200).nullable().optional(),
    expiresOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    warnDays: z.number().int().min(1).max(365).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
    documentId: z.string().max(100).optional(),
  }),
  async (input, principal) => {
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.reference !== undefined) body.reference = input.reference;
    if (input.expiresOn !== undefined) body.expires_on = input.expiresOn;
    if (input.warnDays !== undefined) body.warn_days = input.warnDays;
    if (input.note !== undefined) body.note = input.note;
    if (input.documentId !== undefined) body.document_id = input.documentId;
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/expiry-items/{item_id}/change",
      {
        params: {
          path: { venue_id: input.venueId, item_id: input.itemId },
        },
        body: body as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/expiry`);
    return { id: answer.parse(data).id };
  },
);

export const removeExpiryItem = action(
  strictInput({ ...ids, note: z.string().max(500).optional() }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/expiry-items/{item_id}/remove",
      {
        params: {
          path: { venue_id: input.venueId, item_id: input.itemId },
        },
        body: { note: input.note || null },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/expiry`);
    return { done: true };
  },
);

/** A fresh link to the file each time it is asked for; it is never stored. */
export const fileLink = action(
  strictInput({ venueId: z.uuid(), itemId: z.uuid() }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).GET(
      "/v1/venues/{venue_id}/expiry-items/{item_id}/file",
      {
        params: {
          path: { venue_id: input.venueId, item_id: input.itemId },
        },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    return { url: fileLinkSchema.parse(data).file_url };
  },
);
