"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

/** Make a staff profile for one person named in a roster file (or for everyone, when `staffRef` is left out). */
export const addToTeam = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    staffRef: z.string().min(1).max(200).optional(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/link-from-roster",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          staff_refs: input.staffRef ? [input.staffRef] : null,
        } as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/team`);
    revalidatePath(`/venues/${input.venueId}/team/unlinked`);
    const answer = data as
      | { created?: unknown[]; positions_created?: unknown[] }
      | undefined;
    return {
      created: answer?.created?.length ?? 0,
      positionsCreated: answer?.positions_created?.length ?? 0,
    };
  },
);
