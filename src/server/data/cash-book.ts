import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { toApiFailure } from "../api/errors";

/** One cash payment as the cash book sends it (list items, one payment, and the answer to a cancel). */
export const paymentSchema = z.object({
  id: z.string(),
  paid_on: z.string(),
  kind: z.string(),
  amount_cents: z.number(),
  payee: z
    .object({
      staff_ref: z.string(),
      name: z.string(),
      can_confirm: z.boolean(),
    })
    .nullish(),
  supplier: z.object({ id: z.string(), name: z.string() }).nullish(),
  bill_id: z.string().nullish(),
  bill_due_on: z.string().nullish(),
  pay_period_from: z.string().nullish(),
  pay_period_to: z.string().nullish(),
  note: z.string().nullish(),
  status: z.string(),
  status_label: z.string(),
  confirmed_at: z.string().nullish(),
  cancelled: z.boolean(),
  cancel_reason: z.string().nullish(),
  recorded_by: z.string().nullish(),
  recorded_by_name: z.string().nullish(),
  /** Only on the answer to a cancel of a payment that settled a bill. */
  bill_note: z.string().nullish(),
});
export type CashPayment = z.infer<typeof paymentSchema>;

export const paymentsSchema = z.object({
  items: z.array(paymentSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

export type PaymentFilters = {
  kind?: "wages" | "supplier" | "petty";
  unconfirmed?: boolean;
  from?: string;
  to?: string;
  person?: string;
  supplier?: string;
  offset: number;
};

export const PAGE_SIZE = 50;

const path = (venueId: string) => ({ params: { path: { venue_id: venueId } } });

export function fetchPayments(
  token: string,
  venueId: string,
  f: PaymentFilters,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/cash-book/payments", {
      params: {
        path: { venue_id: venueId },
        query: {
          limit: PAGE_SIZE,
          offset: f.offset,
          ...(f.kind ? { kind: f.kind } : {}),
          ...(f.unconfirmed ? { unconfirmed: true } : {}),
          ...(f.from ? { from: f.from } : {}),
          ...(f.to ? { to: f.to } : {}),
          ...(f.person ? { person: f.person } : {}),
          ...(f.supplier ? { supplier: f.supplier } : {}),
        },
      },
    }),
    paymentsSchema,
    next,
  );
}

export function fetchPayment(
  token: string,
  venueId: string,
  paymentId: string,
  next: string,
) {
  return read(
    backend(token).GET(
      "/v1/venues/{venue_id}/cash-book/payments/{payment_id}",
      {
        params: { path: { venue_id: venueId, payment_id: paymentId } },
      },
    ),
    paymentSchema,
    next,
  );
}

const personSummarySchema = z.object({
  staff_ref: z.string(),
  name: z.string(),
  hours: z.number(),
  rate_cents: z.number().nullish(),
  cost_cents: z.number(),
  incomplete_sessions: z.number(),
  cash_paid_cents: z.number(),
  unconfirmed_cents: z.number(),
  difference_cents: z.number(),
});
export type PersonSummary = z.infer<typeof personSummarySchema>;

export const summarySchema = z.object({
  from: z.string(),
  to: z.string(),
  paid_out: z.object({
    wages: z.number(),
    supplier: z.number(),
    petty: z.number(),
    total_cents: z.number(),
  }),
  unconfirmed: z.object({ count: z.number(), total_cents: z.number() }),
  people: z.array(personSummarySchema),
});
export type CashSummary = z.infer<typeof summarySchema>;

export type SummaryResult =
  | { ok: true; summary: CashSummary }
  | { ok: false; message: string };

/** The reasons the backend refuses a range with a sentence meant for a person. */
const RANGE_CODES = new Set(["bad_date", "bad_range", "range_too_long"]);

/** The summary for a range. A range the backend refuses (backwards, over a year) comes back as its sentence. */
export async function fetchSummary(
  token: string,
  venueId: string,
  from: string,
  to: string,
  next: string,
): Promise<SummaryResult> {
  const answer = await backend(token).GET(
    "/v1/venues/{venue_id}/cash-book/summary",
    { params: { path: { venue_id: venueId }, query: { from, to } } },
  );
  if (answer.response.status === 422) {
    const failure = toApiFailure(422, answer.error);
    if (RANGE_CODES.has(failure.code))
      return { ok: false, message: failure.message };
  }
  return {
    ok: true,
    summary: await read(Promise.resolve(answer), summarySchema, next),
  };
}

export const tillCountSchema = z.object({
  id: z.string(),
  trading_day: z.string(),
  counted_cents: z.number(),
  float_cents: z.number(),
  pos_cash_sales_cents: z.number().nullish(),
  cash_paid_out_cents: z.number(),
  expected_cents: z.number().nullish(),
  gap_cents: z.number().nullish(),
  flag: z.string(),
  flag_label: z.string(),
  note: z.string().nullish(),
  recorded_by: z.string().nullish(),
  recounted: z.boolean(),
});
export type TillCount = z.infer<typeof tillCountSchema>;

const tillCountsSchema = z.object({
  items: z.array(tillCountSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

export function fetchTillCounts(
  token: string,
  venueId: string,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/cash-book/till-counts", {
      params: { ...path(venueId).params, query: { limit: PAGE_SIZE, offset } },
    }),
    tillCountsSchema,
    next,
  );
}

/** A person on the staff list who can be paid; `staff_ref` is what the cash book wants. */
const payableSchema = z.object({
  staff_ref: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export type Payable = { staffRef: string; name: string };

/** The people still on the team (ended ones left out), for the "who was paid" list. */
export function fetchPayable(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/staff", {
      params: { path: { venue_id: venueId }, query: { limit: 200 } },
    }),
    z
      .object({ items: z.array(payableSchema) })
      .transform((p): Payable[] =>
        p.items
          .filter((s) => s.active)
          .map((s) => ({ staffRef: s.staff_ref, name: s.name })),
      ),
    next,
  );
}
