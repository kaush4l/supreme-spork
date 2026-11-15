"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { type ApiFailure, toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const note = z.string().max(300).optional();

export type Outcome = {
  result: "approved" | "rejected" | "already_decided";
  needsPublish: boolean;
};

/** Approve or reject a leave or swap request. A repeat answers "already decided" instead of failing. */
export const decideRequest = action(
  strictInput({
    venueId: z.uuid(),
    requestId: z.string().min(1),
    approve: z.boolean(),
    note,
    key: z.string(),
  }),
  async (
    { venueId, requestId, approve, note, key },
    principal,
  ): Promise<Outcome> => {
    const client = backend(principal.accessToken);
    const options = {
      params: { path: { venue_id: venueId, request_id: requestId } },
      body: note?.trim() ? { note: note.trim() } : {},
      headers: idempotencyHeader(key),
    };
    const { data, error, response } = approve
      ? await client.POST(
          "/v1/venues/{venue_id}/requests/{request_id}/approve",
          options,
        )
      : await client.POST(
          "/v1/venues/{venue_id}/requests/{request_id}/reject",
          options,
        );
    if (error !== undefined || !response.ok) {
      const failure = toApiFailure(response.status, error);
      if (failure.code === "already_decided")
        return { result: "already_decided", needsPublish: false };
      throw failure;
    }
    revalidatePath(`/venues/${venueId}/approvals`);
    const answer = data as { needs_publish?: boolean };
    return {
      result: approve ? "approved" : "rejected",
      needsPublish: answer.needs_publish === true,
    };
  },
);

/** Give a shift-pool shift to the person who asked, or say not this time. */
export const decideClaim = action(
  strictInput({
    venueId: z.uuid(),
    offerId: z.string().min(1),
    claimId: z.string().min(1),
    approve: z.boolean(),
    note,
    key: z.string(),
  }),
  async (
    { venueId, offerId, claimId, approve, note, key },
    principal,
  ): Promise<Outcome> => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/offers/{offer_id}/claims/{claim_id}/decide",
      {
        params: {
          path: { venue_id: venueId, offer_id: offerId, claim_id: claimId },
        },
        body: { approve, ...(note?.trim() ? { note: note.trim() } : {}) },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok) {
      const failure: ApiFailure = toApiFailure(response.status, error);
      if (failure.code === "already_decided")
        return { result: "already_decided", needsPublish: false };
      throw failure;
    }
    revalidatePath(`/venues/${venueId}/approvals`);
    const answer = data as { needs_publish?: boolean };
    return {
      result: approve ? "approved" : "rejected",
      needsPublish: answer.needs_publish === true,
    };
  },
);
