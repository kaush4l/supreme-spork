"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

/** A manager adds a missed clock-in or clock-out for someone. `at` is venue-local time (no zone), the note is required. */
export const addEntry = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    staffId: z.string().min(1),
    kind: z.enum(["in", "out"]),
    at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    breakMinutes: z.number().int().min(0).max(240),
    note: z.string().trim().min(1).max(500),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/time-entries",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          staff_id: input.staffId,
          kind: input.kind,
          at: `${input.at}:00`,
          break_minutes: input.kind === "out" ? input.breakMinutes : 0,
          note: input.note,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/timesheet`);
    return { done: true };
  },
);

/**
 * A manager corrects one clock entry: its time (venue-local, no zone) and/or, on a clock-out, its break.
 * The note is required. One call per entry.
 */
export const correctEntry = action(
  strictInput({
    venueId: z.uuid(),
    entryId: z.string().min(1).max(100),
    at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .optional(),
    breakMinutes: z.number().int().min(0).max(240).optional(),
    note: z.string().trim().min(1).max(500),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/time-entries/{entry_id}/correct",
      {
        params: {
          path: { venue_id: input.venueId, entry_id: input.entryId },
        },
        body: {
          ...(input.at ? { at: `${input.at}:00` } : {}),
          ...(input.breakMinutes !== undefined
            ? { break_minutes: input.breakMinutes }
            : {}),
          note: input.note,
        } as never,
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/timesheet`);
    return { done: true };
  },
);
