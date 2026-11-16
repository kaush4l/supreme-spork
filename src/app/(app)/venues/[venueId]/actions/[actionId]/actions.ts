"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { fetchMe } from "@/server/api/me";
import { withZone } from "../due";

const ids = { venueId: z.uuid(), actionId: z.uuid(), key: z.string() };
const path = (input: { venueId: string; actionId: string }) => ({
  params: {
    path: { venue_id: input.venueId, action_id: input.actionId },
  },
});

function refresh(venueId: string, actionId: string) {
  revalidatePath(`/venues/${venueId}/actions`);
  revalidatePath(`/venues/${venueId}/actions/${actionId}`);
}

/** Give the follow-up an owner, or clear the owner (null). The backend checks the person may own it. */
export const setOwner = action(
  strictInput({ ...ids, ownerUserId: z.uuid().nullable() }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).PATCH(
      "/v1/venues/{venue_id}/corrective-actions/{action_id}",
      {
        ...path(input),
        body: { owner_user_id: input.ownerUserId },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(input.venueId, input.actionId);
    return { done: true };
  },
);

/** A new due time typed as the venue's clock (`2026-11-17T09:00`); it is sent with the venue's zone. */
export const setDue = action(
  strictInput({
    ...ids,
    due: z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/),
  }),
  async (input, principal) => {
    const me = await fetchMe(backend(principal.accessToken));
    const zone =
      me.venues.find((v) => v.id === input.venueId)?.timezone ??
      "Australia/Sydney";
    const { error, response } = await backend(principal.accessToken).PATCH(
      "/v1/venues/{venue_id}/corrective-actions/{action_id}",
      {
        ...path(input),
        body: { due_at: withZone(input.due, zone) },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(input.venueId, input.actionId);
    return { done: true };
  },
);

/** Close it as done, with a note of what was done (the backend refuses an empty one). */
export const markDone = action(
  strictInput({ ...ids, note: z.string().trim().min(1).max(1000) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/corrective-actions/{action_id}/done",
      {
        ...path(input),
        body: { note: input.note },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(input.venueId, input.actionId);
    return { done: true };
  },
);

/** Close it as cancelled, with the reason. */
export const cancelAction = action(
  strictInput({ ...ids, reason: z.string().trim().min(1).max(1000) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/corrective-actions/{action_id}/cancel",
      {
        ...path(input),
        body: { reason: input.reason },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(input.venueId, input.actionId);
    return { done: true };
  },
);
