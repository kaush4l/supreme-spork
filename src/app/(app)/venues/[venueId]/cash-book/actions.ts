"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max).optional();

/**
 * Record cash paid out. Wages need a person, a supplier payment a supplier (and may name the bill date it pays), petty
 * cash a note. The API checks all of it and its sentence is shown as sent (for example `bill_already_paid`).
 */
export const recordPayment = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    kind: z.enum(["wages", "supplier", "petty"]),
    amountCents: z.number().int().positive(),
    paidOn: day.optional(),
    staffRef: text(100),
    supplierId: z.uuid().optional(),
    billId: z.uuid().optional(),
    billDueOn: day.optional(),
    periodFrom: day.optional(),
    periodTo: day.optional(),
    note: text(500),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/cash-book/payments",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          kind: input.kind,
          amount_cents: input.amountCents,
          paid_on: input.paidOn ?? null,
          payee_staff_ref: input.staffRef || null,
          supplier_id: input.supplierId ?? null,
          bill_id: input.billId ?? null,
          bill_due_on: input.billDueOn ?? null,
          pay_period_from: input.periodFrom ?? null,
          pay_period_to: input.periodTo ?? null,
          note: input.note || null,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/cash-book`);
    return { id: (data as { id?: string }).id ?? null };
  },
);

/** Cancel a payment with a reason. A paid bill stays paid: the answer's `bill_note` says so and is shown. */
export const cancelPayment = action(
  strictInput({
    venueId: z.uuid(),
    paymentId: z.uuid(),
    key: z.string(),
    reason: z.string().trim().min(1).max(500),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/cash-book/payments/{payment_id}/cancel",
      {
        params: {
          path: { venue_id: input.venueId, payment_id: input.paymentId },
        },
        body: { reason: input.reason },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/cash-book`);
    return {
      billNote: (data as { bill_note?: string | null }).bill_note ?? null,
    };
  },
);

/** Count the till for a trading day (a day left out is today's). Counting a day again replaces that day's count. */
export const recordTillCount = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    tradingDay: day.optional(),
    countedCents: z.number().int().min(0),
    floatCents: z.number().int().min(0),
    note: text(500),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/cash-book/till-counts",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          trading_day: input.tradingDay ?? null,
          counted_cents: input.countedCents,
          float_cents: input.floatCents,
          note: input.note || null,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/cash-book/till`);
    const made = data as { flag?: string; flag_label?: string };
    return { flag: made.flag ?? "", flagLabel: made.flag_label ?? "" };
  },
);
