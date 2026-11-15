"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const where = { venueId: z.uuid(), key: z.string() };
const refresh = (venueId: string) => {
  revalidatePath(`/venues/${venueId}/waste`);
  revalidatePath(`/venues/${venueId}/waste/report`);
};

/** Record something thrown away. The same key again adds nothing. */
export const recordWaste = action(
  strictInput({
    ...where,
    itemId: z.string().min(1),
    qty: z.number().gt(0).max(1000000),
    unit: z.string().min(1),
    reason: z.string().min(1),
    note: z.string().trim().max(500).optional(),
    photoDocumentId: z.string().optional(),
  }),
  async (
    { venueId, key, itemId, qty, unit, reason, note, photoDocumentId },
    principal,
  ) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/waste",
      {
        params: { path: { venue_id: venueId } },
        body: {
          item_id: itemId,
          qty,
          unit,
          reason,
          note: note || undefined,
          photo_document_id: photoDocumentId,
        },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    return { id: String((data as { id?: unknown } | undefined)?.id ?? "") };
  },
);

/** Correct an entry: only what changed is sent. The answer carries the entry's new id. */
export const changeWaste = action(
  strictInput({
    ...where,
    entryId: z.string().min(1),
    qty: z.number().gt(0).max(1000000).optional(),
    reason: z.string().min(1).optional(),
    note: z.string().trim().max(500).optional(),
    photoDocumentId: z.string().optional(),
  }),
  async (
    { venueId, key, entryId, qty, reason, note, photoDocumentId },
    principal,
  ) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/waste/{entry_id}/change",
      {
        params: { path: { venue_id: venueId, entry_id: entryId } },
        body: {
          qty,
          reason,
          note,
          photo_document_id: photoDocumentId,
        },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    const answer = data as { id?: unknown; changed_now?: unknown } | undefined;
    return {
      id: String(answer?.id ?? entryId),
      changed: answer?.changed_now !== false,
    };
  },
);

/** Take an entry back. It stays in the history and drops out of the report. */
export const removeWaste = action(
  strictInput({ ...where, entryId: z.string().min(1) }),
  async ({ venueId, key, entryId }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/waste/{entry_id}/remove",
      {
        params: { path: { venue_id: venueId, entry_id: entryId } },
        body: {},
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    return { removed: true };
  },
);
