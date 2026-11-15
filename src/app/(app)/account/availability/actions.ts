"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const addAvailability = action(
  strictInput({
    key: z.string(),
    kind: z.enum(["weekly", "once"]),
    weekday: z.number().int().min(0).max(6).optional(),
    fromTime: time.optional(),
    toTime: time.optional(),
    startDate: day.optional(),
    endDate: day.optional(),
    available: z.boolean(),
    note: z.string().max(200).optional(),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/me/availability",
      {
        body: {
          kind: input.kind,
          weekday: input.weekday,
          from_time: input.fromTime,
          to_time: input.toTime,
          start_date: input.startDate,
          end_date: input.endDate,
          available: input.available,
          note: input.note || undefined,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/account/availability");
    return { saved: true };
  },
);

export const removeAvailability = action(
  strictInput({ rowId: z.string().min(1).max(64) }),
  async ({ rowId }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/me/availability/{row_id}/remove",
      { params: { path: { row_id: rowId } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/account/availability");
    return { removed: true };
  },
);
