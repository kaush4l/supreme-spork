import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const salesFileSummarySchema = z.object({
  document_id: z.string(),
  filename: z.string().nullish(),
  received_at: z.string(),
  type: z.string().nullish(),
  status: z.string(),
  label: z.string(),
  help: z.string(),
  rows_read: z.number(),
  reasons: z.array(z.string()),
});
export type SalesFile = z.infer<typeof salesFileSummarySchema>;

export const salesFileDetailSchema = salesFileSummarySchema.extend({
  period_start: z.string().nullish(),
  period_end: z.string().nullish(),
  rows: z.array(
    z.object({
      line: z.number(),
      item: z.string().nullish(),
      channel: z.string().nullish(),
      qty: z.union([z.string(), z.number()]).nullish(),
      gross_cents: z.number(),
      discount_cents: z.number().nullish(),
      void: z.boolean().optional(),
      trading_day: z.string().nullish(),
    }),
  ),
  rows_total: z.number(),
  rows_shown: z.number(),
  gross_cents: z.number(),
  commissions: z.number(),
  commission_cents: z.number(),
  file_url: z.string().nullish(),
  file_expires_in_seconds: z.number().nullish(),
});
export type SalesFileDetail = z.infer<typeof salesFileDetailSchema>;

export function fetchSalesFileQueue(
  accessToken: string,
  venueId: string,
  status: "check" | "all",
  offset: number,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/sales-reports/review", {
      params: {
        path: { venue_id: venueId },
        query: { status, limit: 25, offset },
      },
    }),
    z.object({
      items: z.array(salesFileSummarySchema),
      total: z.number(),
      offset: z.number(),
      limit: z.number(),
    }),
    next,
  );
}

export function fetchSalesFile(
  accessToken: string,
  venueId: string,
  documentId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/sales-reports/{document_id}",
      { params: { path: { venue_id: venueId, document_id: documentId } } },
    ),
    salesFileDetailSchema,
    next,
  );
}
