import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

const text = z.string().nullable();
const cents = z.number().nullable();

/** One docket in the review queue (and the top of one docket's page). `label` and `help` are the API's words. */
export const docketSummarySchema = z.object({
  document_id: z.string(),
  filename: z.string(),
  received_at: z.string(),
  /** needs_check, needs_keying, booked or rejected */
  status: z.string(),
  label: z.string(),
  help: z.string(),
  supplier: text,
  delivery_date: text,
  total_cents: cents,
  reasons: z.array(z.string()),
});
export type DocketSummary = z.infer<typeof docketSummarySchema>;

export function docketQueue(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/dockets/queue", {
      params: { path: { venue_id: venueId } },
    }),
    z.object({ items: z.array(docketSummarySchema), total: z.number() }),
    next,
  );
}

const copyInfoSchema = z.object({
  document_id: z.string(),
  filename: z.string(),
  supplier: text,
  delivery_date: text,
  invoice_no: text,
  total_cents: cents,
  /** waiting (in the review queue) or booked */
  status: z.string(),
});

export const duplicatePairSchema = z.object({
  later: copyInfoSchema,
  earlier: copyInfoSchema,
  rule_label: z.string(),
  status: z.string(),
});
export type DuplicatePair = z.infer<typeof duplicatePairSchema>;

export function docketDuplicates(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/dockets/duplicates", {
      params: { path: { venue_id: venueId } },
    }),
    z.object({ items: z.array(duplicatePairSchema) }).transform((p) => p.items),
    next,
  );
}

export const docketLineSchema = z.object({
  /** Starts at 1. */
  line: z.number().int(),
  description: text,
  qty: z.number().nullable(),
  unit_text: text,
  pack_size: z.number().nullable(),
  pack_unit: text,
  unit_price_cents: cents,
  total_cents: cents,
  gst_cents: cents,
  flags: z.array(z.string()),
});
export type DocketLine = z.infer<typeof docketLineSchema>;

export const docketDetailSchema = docketSummarySchema.extend({
  invoice_no: text,
  gst_cents: cents,
  currency: z.string(),
  lines: z.array(docketLineSchema),
  lines_sum_cents: cents,
  /** A signed link that stops working after `image_expires_in_seconds`; never stored. */
  image_url: text,
  image_expires_in_seconds: z.number(),
  mime_type: text,
});
export type DocketDetail = z.infer<typeof docketDetailSchema>;

export function docketDetail(
  token: string,
  venueId: string,
  documentId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/dockets/{document_id}", {
      params: { path: { venue_id: venueId, document_id: documentId } },
    }),
    docketDetailSchema,
    next,
  );
}

/** `2026-10-14` as "Wed 14 Oct". Only formats the date the API sent. */
export function deliveryDay(date: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "date not read";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}
