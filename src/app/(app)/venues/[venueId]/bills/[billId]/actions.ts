"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ids = { venueId: z.uuid(), billId: z.uuid(), key: z.string() };

/** Change a bill: only the fields sent are changed. `retire` takes the bill off the list. The answer holds the new id. */
export const editBill = action(
  strictInput({
    ...ids,
    label: z.string().trim().min(1).max(200).optional(),
    amountCents: z.number().int().positive().optional(),
    cadence: z
      .enum(["weekly", "fortnightly", "monthly", "quarterly"])
      .optional(),
    nextDue: day.optional(),
    retire: z.boolean().optional(),
  }),
  async (input, principal) => {
    const body = input.retire
      ? { retire: true }
      : {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.amountCents !== undefined
            ? { amount_cents: input.amountCents }
            : {}),
          ...(input.cadence !== undefined ? { cadence: input.cadence } : {}),
          ...(input.nextDue !== undefined ? { next_due: input.nextDue } : {}),
        };
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bills/{bill_id}",
      {
        params: { path: { venue_id: input.venueId, bill_id: input.billId } },
        body,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bills`);
    const answer = data as {
      bill_id?: string;
      next_due?: string;
      retired?: boolean;
    };
    return {
      billId: answer.bill_id ?? input.billId,
      nextDue: answer.next_due ?? null,
      retired: answer.retired === true,
    };
  },
);

/** Mark one due date paid, not due, or open again (takes the mark back). */
export const markDue = action(
  strictInput({
    ...ids,
    dueOn: day,
    status: z.enum(["paid", "not_due", "open"]),
    note: z.string().trim().max(500).optional(),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bills/{bill_id}/occurrences/{due_on}/mark",
      {
        params: {
          path: {
            venue_id: input.venueId,
            bill_id: input.billId,
            due_on: input.dueOn,
          },
        },
        body: { status: input.status, note: input.note || null },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bills`);
    return { done: true };
  },
);

export const linkDocket = action(
  strictInput({
    ...ids,
    documentId: z.string().trim().min(1).max(100),
    dueOn: day.optional(),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bills/{bill_id}/dockets",
      {
        params: { path: { venue_id: input.venueId, bill_id: input.billId } },
        body: { document_id: input.documentId, due_on: input.dueOn ?? null },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bills`);
    return { done: true };
  },
);

export const unlinkDocket = action(
  strictInput({ ...ids, documentId: z.string().trim().min(1).max(100) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bills/{bill_id}/dockets/{document_id}/unlink",
      {
        params: {
          path: {
            venue_id: input.venueId,
            bill_id: input.billId,
            document_id: input.documentId,
          },
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bills`);
    return { done: true };
  },
);
