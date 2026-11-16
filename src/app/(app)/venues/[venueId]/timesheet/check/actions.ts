"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Set one exception aside with a reason (timesheet.correct). The key is the one the exceptions list sent. */
export const setAside = action(
  strictInput({
    venueId: z.uuid(),
    idemKey: z.string().min(1).max(100),
    key: z.string().min(1).max(500),
    reason: z.string().trim().min(1).max(1000),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/timesheet/exceptions/dismiss",
      {
        params: { path: { venue_id: input.venueId } },
        body: { key: input.key, reason: input.reason },
        headers: idempotencyHeader(input.idemKey),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/timesheet/check`);
    return { done: true };
  },
);

/** Record that the period was checked (timesheet.correct). The note is optional. */
export const markChecked = action(
  strictInput({
    venueId: z.uuid(),
    idemKey: z.string().min(1).max(100),
    from: day,
    to: day,
    note: z.string().trim().max(1000),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/timesheet/reviews",
      {
        params: { path: { venue_id: input.venueId } },
        body: { from: input.from, to: input.to, note: input.note },
        headers: idempotencyHeader(input.idemKey),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/timesheet/check`);
    return { done: true };
  },
);
