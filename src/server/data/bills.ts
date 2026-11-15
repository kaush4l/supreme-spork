import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const docketLinkSchema = z.object({
  document_id: z.string(),
  filename: z.string().nullish(),
  received_at: z.string().nullish(),
  due_on: z.string().nullish(),
});

export const occurrenceSchema = z.object({
  bill_id: z.string(),
  label: z.string(),
  kind: z.string(),
  counterparty: z.string().nullish(),
  amount_cents: z.number(),
  cadence: z.string(),
  source: z.string(),
  due_on: z.string(),
  state: z.string(),
  state_label: z.string(),
  help: z.string(),
  note: z.string().nullish(),
  dockets: z.array(docketLinkSchema),
});
export type Occurrence = z.infer<typeof occurrenceSchema>;

export const billDetailSchema = z.object({
  bill_id: z.string(),
  label: z.string(),
  kind: z.string(),
  counterparty: z.string().nullish(),
  amount_cents: z.number(),
  cadence: z.string(),
  next_due: z.string().nullish(),
  source: z.string(),
  dockets: z.array(docketLinkSchema),
  occurrences: z.array(occurrenceSchema),
});

export const billsSchema = z.object({
  from: z.string(),
  to: z.string(),
  items: z.array(occurrenceSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  due_total_cents: z.number(),
});

const overdueRowSchema = z.object({
  document_id: z.string(),
  filename: z.string().nullish(),
  supplier: z.string(),
  delivered_on: z.string(),
  invoice_no: z.string().nullish(),
  total_cents: z.number(),
  due_on: z.string().nullish(),
  days_overdue: z.number().nullish(),
  reason: z.string().nullish(),
});

export const overdueSchema = z.object({
  as_of: z.string(),
  overdue: z.array(overdueRowSchema),
  overdue_total_cents: z.number(),
  terms_missing: z.array(
    z.object({
      supplier: z.string(),
      supplier_id: z.string().nullish(),
      dockets: z.number(),
      total_cents: z.number(),
    }),
  ),
  not_checked: z.array(overdueRowSchema),
  basis: z.string().nullish(),
});

/** `from`/`to` are left out to get the API's own default range (today and the next 30 days). */
export function fetchBills(
  accessToken: string,
  venueId: string,
  range: { from?: string; to?: string; status: "due" | "all"; offset: number },
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/bills", {
      params: {
        path: { venue_id: venueId },
        query: {
          status: range.status,
          limit: 50,
          offset: range.offset,
          ...(range.from ? { from: range.from } : {}),
          ...(range.to ? { to: range.to } : {}),
        },
      },
    }),
    billsSchema,
    next,
  );
}

/** One bill with its next due dates; an id replaced by an edit answers with the newest version (its `bill_id` differs). */
export function fetchBill(
  accessToken: string,
  venueId: string,
  billId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/bills/{bill_id}", {
      params: { path: { venue_id: venueId, bill_id: billId } },
    }),
    billDetailSchema,
    next,
  );
}

export function fetchOverdue(
  accessToken: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/bills/overdue", {
      params: { path: { venue_id: venueId } },
    }),
    overdueSchema,
    next,
  );
}
