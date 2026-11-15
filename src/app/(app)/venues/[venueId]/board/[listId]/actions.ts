"use server";

import { revalidatePath } from "next/cache";
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
