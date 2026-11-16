"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { isMonday } from "../week";

const answer = z.object({
  filled: z.array(z.object({ external_id: z.string() })),
  skipped: z.array(z.object({ external_id: z.string(), reason: z.string() })),
});

/** Fill the shifts the manager chose with the people chosen. Ones that no longer work come back in `skipped`. */
export const acceptSuggestions = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    week: z.string().refine(isMonday),
    assignments: z
      .array(z.object({ externalId: z.string(), staffId: z.string() }))
      .min(1)
      .max(200),
  }),
  async ({ venueId, key, week, assignments }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/weeks/{week}/suggestions/accept",
      {
        params: { path: { venue_id: venueId, week } },
        body: {
          assignments: assignments.map((a) => ({
            external_id: a.externalId,
            staff_id: a.staffId,
          })),
        },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/roster`);
    revalidatePath(`/venues/${venueId}/roster/suggestions`);
    const a = answer.safeParse(data);
    if (!a.success) throw toApiFailure(502, null);
    return {
      filled: a.data.filled.map((f) => f.external_id),
      skipped: a.data.skipped.map((s) => ({
        externalId: s.external_id,
        reason: s.reason,
      })),
    };
  },
);
