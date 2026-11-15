"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import {
  answerBody,
  answerInput,
  savedFrom,
} from "../../lists/[listId]/answer-input";

/** A manager answers an item on someone's list. */
export const answerForSomeone = action(
  strictInput(answerInput),
  async ({ venueId, listId, itemKey, key, ...answer }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/lists/{list_id}/items/{item_key}/answer",
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
    revalidatePath(`/venues/${venueId}/board/${listId}`);
    revalidatePath(`/venues/${venueId}/board`);
    return savedFrom(data);
  },
);

const where = { venueId: z.uuid(), listId: z.uuid() };
const refresh = (venueId: string, listId: string) => {
  revalidatePath(`/venues/${venueId}/board/${listId}`);
  revalidatePath(`/venues/${venueId}/board`);
};

const kind = z.enum(["tick", "number", "note", "photo"]);
const itemFields = {
  label: z.string().trim().min(1).max(200),
  kind,
  required: z.boolean(),
  instruction: z.string().max(1000).nullable(),
  minValue: z.number().finite().nullable(),
  maxValue: z.number().finite().nullable(),
};

/** Add an item to this one list (the template is not changed). */
export const addListItem = action(
  strictInput({ ...where, key: z.string(), ...itemFields }),
  async (i, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/lists/{list_id}/items",
      {
        params: { path: { venue_id: i.venueId, list_id: i.listId } },
        body: {
          label: i.label,
          kind: i.kind,
          required: i.required,
          instruction: i.instruction,
          min_value: i.minValue,
          max_value: i.maxValue,
        },
        headers: idempotencyHeader(i.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(i.venueId, i.listId);
    return { done: true };
  },
);

/** Change one item on this list: wording, kind, range, required, instruction and place in the list. */
export const changeListItem = action(
  strictInput({
    ...where,
    itemKey: z.string().min(1).max(64),
    ...itemFields,
    sortOrder: z.number().int().min(0),
  }),
  async (i, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/lists/{list_id}/items/{item_key}",
      {
        params: {
          path: { venue_id: i.venueId, list_id: i.listId, item_key: i.itemKey },
        },
        body: {
          remove: false,
          label: i.label,
          kind: i.kind,
          required: i.required,
          instruction: i.instruction,
          min_value: i.minValue,
          max_value: i.maxValue,
          sort_order: i.sortOrder,
        },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(i.venueId, i.listId);
    return { done: true };
  },
);

/** Take an item that was added off the list. A template item answers 409 `template_item_kept`. */
export const removeListItem = action(
  strictInput({ ...where, itemKey: z.string().min(1).max(64) }),
  async ({ venueId, listId, itemKey }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/lists/{list_id}/items/{item_key}",
      {
        params: {
          path: { venue_id: venueId, list_id: listId, item_key: itemKey },
        },
        body: { remove: true },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, listId);
    return { done: true };
  },
);

/** Mark an item not applicable (with a reason) or undo that. */
export const markListItemNotApplicable = action(
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
      "/v1/venues/{venue_id}/workflows/lists/{list_id}/items/{item_key}",
      {
        params: {
          path: { venue_id: venueId, list_id: listId, item_key: itemKey },
        },
        body: notApplicable
          ? { remove: false, not_applicable: true, na_reason: reason }
          : { remove: false, not_applicable: false },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, listId);
    return { done: true };
  },
);

/** Finish the list. A 409 `list_incomplete` carries the sentence naming what is left. */
export const finishListAsManager = action(
  strictInput(where),
  async ({ venueId, listId }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/lists/{list_id}/complete",
      { params: { path: { venue_id: venueId, list_id: listId } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, listId);
    return { late: (data as { late?: unknown } | undefined)?.late === true };
  },
);

/** Make a new template from this list as it now stands. Answers the new template's key. */
export const saveListAsTemplate = action(
  strictInput({
    ...where,
    key: z.string(),
    name: z.string().trim().max(120).optional(),
  }),
  async ({ venueId, listId, key, name }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/lists/{list_id}/save-as-template",
      {
        params: { path: { venue_id: venueId, list_id: listId } },
        body: name ? { name } : {},
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/checklists`);
    return {
      templateKey: z.object({ template_key: z.string() }).parse(data)
        .template_key,
    };
  },
);
