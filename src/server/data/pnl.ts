import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { toApiFailure } from "../api/errors";

export const PERIODS = ["day", "week", "month"] as const;
export type Period = (typeof PERIODS)[number];

const status = z.string();

export const lineSchema = z.object({
  key: z.string(),
  label: z.string(),
  section: z.string(),
  amount_cents: z.number().nullable(),
  basis: z.string(),
  date_used: z.string(),
  status,
  note: z.string().nullable(),
  sources: z.record(z.string(), z.number()),
});
export type PnlLine = z.infer<typeof lineSchema>;

export const totalSchema = z.object({
  key: z.string(),
  label: z.string(),
  amount_cents: z.number().nullable(),
  status,
  note: z.string().nullable(),
});

export const bucketSchema = z.object({
  start: z.string(),
  end: z.string(),
  cut: z.boolean(),
  lines: z.array(lineSchema),
  totals: z.record(z.string(), totalSchema),
  completeness: z.array(z.string()),
});
export type PnlBucket = z.infer<typeof bucketSchema>;

export const pnlSchema = z.object({
  period: z.string(),
  from: z.string(),
  to: z.string(),
  range_defaulted: z.boolean().optional(),
  basis: z.record(z.string(), z.string()),
  buckets: z.array(bucketSchema),
});
export type Pnl = z.infer<typeof pnlSchema>;

export type PnlResult =
  | { ok: true; report: Pnl }
  | { ok: false; message: string };

/** The profit and loss for a range. A refused range (too long, backwards) comes back as the API's own sentence. */
export async function fetchPnl(
  accessToken: string,
  venueId: string,
  period: Period,
  range: { from: string; to: string } | null,
  next: string,
): Promise<PnlResult> {
  const answer = await backend(accessToken).GET("/v1/venues/{venue_id}/pnl", {
    params: {
      path: { venue_id: venueId },
      query: range ? { period, ...range } : { period },
    },
  });
  if (answer.response.status === 422)
    return {
      ok: false,
      message: toApiFailure(422, answer.error).message,
    };
  return {
    ok: true,
    report: await read(Promise.resolve(answer), pnlSchema, next),
  };
}

export const sourceRowsSchema = z.object({
  line: z.string(),
  group: z.string(),
  from: z.string(),
  to: z.string(),
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        kind: z.enum([
          "text",
          "money_cents",
          "date",
          "datetime",
          "number",
          "percent",
        ]),
      }),
    )
    .default([]),
  items: z.array(z.record(z.string(), z.unknown())),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});
export type SourceRows = z.infer<typeof sourceRowsSchema>;

export type SourcesResult =
  | { ok: true; rows: SourceRows }
  | { ok: false; message: string };

export async function fetchSources(
  accessToken: string,
  venueId: string,
  line: string,
  from: string,
  to: string,
  group: string | undefined,
  offset: number,
  next: string,
): Promise<SourcesResult> {
  const answer = await backend(accessToken).GET(
    "/v1/venues/{venue_id}/pnl/sources",
    {
      params: {
        path: { venue_id: venueId },
        query: { line, from, to, group, limit: PAGE, offset },
      },
    },
  );
  if (answer.response.status === 422)
    return { ok: false, message: toApiFailure(422, answer.error).message };
  if (
    answer.response.status === 404 &&
    typeof answer.error === "object" &&
    JSON.stringify(answer.error).includes("line_not_found")
  )
    return { ok: false, message: toApiFailure(404, answer.error).message };
  return {
    ok: true,
    rows: await read(Promise.resolve(answer), sourceRowsSchema, next),
  };
}

/** Rows per page on the sources screen (the API pages with limit and offset). */
export const PAGE = 50;
