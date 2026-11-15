"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { answerBody, answerInput, savedFrom } from "./answer-input";

const where = { venueId: z.uuid(), listId: z.uuid() };
const refresh = (venueId: string, listId: string) => {
  revalidatePath(`/venues/${venueId}/lists/${listId}`);
  revalidatePath(`/venues/${venueId}/lists`);
};

/** Answer one item on my list. The backend flags a number outside the item's range and still saves it. */
export const answerItem = action(
  strictInput(answerInput),
  async ({ venueId, listId, itemKey, key, ...answer }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/me/lists/{list_id}/items/{item_key}/answer",
      {
        params: {
          path: { venue_id: venueId, list_id: listId, item_key: itemKey },
        },
        body: answerBody(answer),
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, listId);
    return savedFrom(data);
  },
);

/** Mark an item not applicable (with a reason) or undo that. */
export const markNotApplicable = action(
  strictInput({
    ...where,
    itemKey: z.string().min(1).max(64),
    notApplicable: z.boolean(),
    reason: z.string().trim().max(200).optional(),
  }),
  async ({ venueId, listId, itemKey, notApplicable, reason }, principal) => {
    if (notApplicable && !reason)
      throw toApiFailure(422, {
        error: {
          code: "reason_needed",
          message: "Say why this does not apply.",
          field: "reason",
        },
      });
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/me/lists/{list_id}/items/{item_key}",
      {
        params: {
          path: { venue_id: venueId, list_id: listId, item_key: itemKey },
        },
        // `remove` is left out on purpose: the backend treats any field the caller sends (even false) as a manager-only
        // change, so sending `remove: false` made staff get 403. The generated type wrongly lists it as required.
        body: (notApplicable
          ? { not_applicable: true, na_reason: reason }
          : { not_applicable: false }) as unknown as { remove: boolean },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, listId);
    return { done: true };
  },
);

/** Add my own item to this list only (never required). */
export const addMyItem = action(
  strictInput({
    ...where,
    key: z.string(),
    label: z.string().trim().min(1).max(200),
    kind: z.enum(["tick", "number", "note", "photo"]),
  }),
  async ({ venueId, listId, key, label, kind }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/me/lists/{list_id}/items",
      {
        params: { path: { venue_id: venueId, list_id: listId } },
        body: { label, kind, required: false },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, listId);
    return { done: true };
  },
);

/** Finish my list. A 409 `list_incomplete` carries the sentence naming what is left; the client shows it as it is. */
export const finishList = action(
  strictInput(where),
  async ({ venueId, listId }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/me/lists/{list_id}/complete",
      { params: { path: { venue_id: venueId, list_id: listId } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, listId);
    return { late: (data as { late?: unknown } | undefined)?.late === true };
  },
);
