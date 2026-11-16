import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** One cash payment as the person paid sees it. `status` is unconfirmed, confirmed, cancelled or recorded. */
export const myCashPaymentSchema = z.object({
  id: z.string(),
  /** A trading day, `YYYY-MM-DD`. */
  paid_on: z.string(),
  kind: z.string(),
  amount_cents: z.number(),
  pay_period_from: z.string().nullish(),
  pay_period_to: z.string().nullish(),
  note: z.string().nullish(),
  status: z.string(),
  status_label: z.string(),
  confirmed_at: z.string().nullish(),
  cancelled: z.boolean(),
  cancel_reason: z.string().nullish(),
  recorded_by_name: z.string().nullish(),
});
export type MyCashPayment = z.infer<typeof myCashPaymentSchema>;

const pageSchema = z.object({
  items: z.array(myCashPaymentSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  unconfirmed_count: z.number(),
});

export const CASH_PAGE_SIZE = 50;

/** The caller's own cash payments, newest first. Staff only ever see their own. */
export function myCashPayments(
  token: string,
  venueId: string,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/me/cash-payments", {
      params: {
        path: { venue_id: venueId },
        query: { limit: CASH_PAGE_SIZE, offset },
      },
    }),
    pageSchema,
    next,
  );
}
