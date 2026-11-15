import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** One figure: an amount or null, always with its status and a plain note saying why it is blank. */
export const figureSchema = z.object({
  key: z.string().optional(),
  label: z.string(),
  amount_cents: z.number().nullable(),
  status: z.string(),
  note: z.string().nullish(),
});
export type Figure = z.infer<typeof figureSchema>;

export const summarySchema = z.object({
  day: z.string(),
  stored: z.boolean(),
  stored_at: z.string().nullable(),
  source: z.string().nullable(),
  versions: z.number(),
  stored_note: z.string().nullable(),
  basis: z.record(z.string(), z.string()).optional(),
  sales: z.object({
    net_sales: figureSchema,
    channels: z.array(figureSchema),
  }),
  purchases: figureSchema,
  labour: figureSchema.extend({
    labour_pct: z.string().nullable(),
    target_pct: z.string().nullable(),
    vs_target: z.string(),
    pct_note: z.string().nullish(),
  }),
  prime_cost: z.object({
    prime_cents: z.number().nullable(),
    prime_pct: z.string().nullable(),
    target_pct: z.string().nullable(),
    vs_target: z.string(),
    over_target_cents: z.number().nullable(),
    status: z.string(),
    note: z.string().nullish(),
    basis: z.string().nullish(),
  }),
  open_findings: z.object({
    count: z.number(),
    items: z.array(
      z.object({
        id: z.string(),
        kind: z.string(),
        week_start: z.string(),
        value_cents: z.number().nullable(),
        text: z.string(),
      }),
    ),
  }),
  attention: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      count: z.number(),
      text: z.string(),
      where: z.string().nullish(),
      target: z
        .object({ kind: z.string(), id: z.string().nullish() })
        .nullish(),
    }),
  ),
  completeness: z.array(z.string()),
});
export type Summary = z.infer<typeof summarySchema>;

export const historySchema = z.object({
  items: z.array(
    z.object({
      day: z.string(),
      stored_at: z.string(),
      source: z.string().nullable(),
      net_sales_cents: z.number().nullable(),
      purchases_cents: z.number().nullable(),
      labour_cents: z.number().nullable(),
      labour_pct: z.string().nullable(),
      prime_pct: z.string().nullable(),
      prime_vs_target: z.string(),
      attention_count: z.number(),
      open_findings: z.number(),
    }),
  ),
  total: z.number(),
});

export function fetchSummary(
  token: string,
  venueId: string,
  day: string | undefined,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/summary", {
      params: {
        path: { venue_id: venueId },
        query: day ? { day } : {},
      },
    }),
    summarySchema,
    next,
  );
}

export function fetchHistory(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/summary/history", {
      params: { path: { venue_id: venueId }, query: { limit: 10 } },
    }),
    historySchema,
    next,
  );
}
