"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const wall = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

/**
 * My answer to one shift of a draft roster: accept, decline, ask for another time (`propose`, with a start and an end
 * in the venue's time, no zone) or pick up an open shift. The answer can be changed until the manager decides it.
 */
export const replyToDraft = action(
  strictInput({
    venueId: z.uuid(),
    draftId: z.string().min(1).max(100),
    externalId: z.string().min(1).max(200),
    key: z.string(),
    response: z.enum(["accept", "decline", "propose", "pickup"]),
    reason: z.string().trim().max(300).optional(),
    start: wall.optional(),
    end: wall.optional(),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/me/roster/drafts/{draft_id}/replies",
      {
        params: {
          path: { venue_id: input.venueId, draft_id: input.draftId },
        },
        body: {
          external_id: input.externalId,
          response: input.response,
          reason: input.reason || null,
          start: input.start ? `${input.start}:00` : null,
          end: input.end ? `${input.end}:00` : null,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/shifts/drafts`);
    revalidatePath(`/venues/${input.venueId}/shifts`);
    return { done: true };
  },
);
