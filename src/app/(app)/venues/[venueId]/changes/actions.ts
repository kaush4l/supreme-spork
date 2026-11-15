"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const input = {
  venueId: z.uuid(),
  requestId: z.string().min(1),
  key: z.string(),
};

/** How an approval ended: applied, failed (with the reason) or stale (the thing changed since). */
const outcome = z.object({
  status: z.string().optional(),
  status_label: z.string().optional(),
  result: z.unknown().optional(),
});

export const approveRequest = action(
  strictInput({ ...input, note: z.string().max(500).optional() }),
  async ({ venueId, requestId, key, note }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/change-requests/{request_id}/approve",
      {
        params: { path: { venue_id: venueId, request_id: requestId } },
        body: { note: note || null } as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/changes`);
    const answer = outcome.safeParse(data);
    return {
      statusLabel: answer.success ? (answer.data.status_label ?? null) : null,
    };
  },
);

export const rejectRequest = action(
  strictInput({ ...input, note: z.string().max(500).optional() }),
  async ({ venueId, requestId, key, note }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/change-requests/{request_id}/reject",
      {
        params: { path: { venue_id: venueId, request_id: requestId } },
        body: { note: note || null } as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/changes`);
    return { statusLabel: null };
  },
);

export const withdrawRequest = action(
  strictInput(input),
  async ({ venueId, requestId, key }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/change-requests/{request_id}/withdraw",
      {
        params: { path: { venue_id: venueId, request_id: requestId } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/changes`);
    return { statusLabel: null };
  },
);

/** The owner says who approves a right: off, owner or partner. Only some rights can be set; the backend says which. */
export const setApproval = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    capability: z.string().min(1).max(80),
    approval: z.enum(["off", "owner", "partner"]),
  }),
  async ({ venueId, key, capability, approval }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/permissions/approval",
      {
        params: { path: { venue_id: venueId } },
        body: { capability, approval },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/rules`);
    return { done: true };
  },
);
