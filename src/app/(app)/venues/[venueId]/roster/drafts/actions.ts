"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { isMonday } from "../week";

const sentAnswer = z.object({ id: z.string() });

/** Send a week as a draft (`mode` draft). The answer carries the draft's id, which the screen opens. */
export const sendDraft = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    week: z.string().refine(isMonday),
    replyHours: z
      .union([z.literal(24), z.literal(48), z.literal(72)])
      .nullable(),
  }),
  async ({ venueId, key, week, replyHours }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/weeks/{week}/send",
      {
        params: { path: { venue_id: venueId, week } },
        body: { mode: "draft", reply_hours: replyHours },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    const a = sentAnswer.safeParse(data);
    if (!a.success) throw toApiFailure(502, null);
    revalidatePath(`/venues/${venueId}/roster`);
    return { draftId: a.data.id };
  },
);

const refresh = (venueId: string, draftId: string) => {
  revalidatePath(`/venues/${venueId}/roster/drafts/${draftId}`);
  revalidatePath(`/venues/${venueId}/roster`);
};

/** Approve or turn down a proposed time or a pick-up. */
export const decideReply = action(
  strictInput({
    venueId: z.uuid(),
    draftId: z.string(),
    replyId: z.string(),
    key: z.string(),
    approve: z.boolean(),
  }),
  async ({ venueId, draftId, replyId, key, approve }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/drafts/{draft_id}/replies/{reply_id}/decide",
      {
        params: {
          path: { venue_id: venueId, draft_id: draftId, reply_id: replyId },
        },
        body: { approve },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, draftId);
    return { approved: approve };
  },
);

const publishAnswer = z.object({
  status: z.string().optional(),
  version: z.number().optional(),
  unchanged: z.boolean().optional(),
});

/** Publish the draft's week. The backend answers 202 when the owner wants a second person to approve it first. */
export const publishDraft = action(
  strictInput({ venueId: z.uuid(), draftId: z.string(), key: z.string() }),
  async ({ venueId, draftId, key }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/drafts/{draft_id}/publish",
      {
        params: { path: { venue_id: venueId, draft_id: draftId } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, draftId);
    const a = publishAnswer.safeParse(data);
    const needsApproval =
      response.status === 202 ||
      (a.success && a.data.status === "needs_approval");
    return {
      needsApproval,
      version: a.success ? (a.data.version ?? null) : null,
    };
  },
);

export const cancelDraft = action(
  strictInput({ venueId: z.uuid(), draftId: z.string(), key: z.string() }),
  async ({ venueId, draftId, key }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/drafts/{draft_id}/cancel",
      {
        params: { path: { venue_id: venueId, draft_id: draftId } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, draftId);
    return { done: true };
  },
);
