import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const PAGE_SIZE = 20;

export const reasonSchema = z.object({ code: z.string(), label: z.string() });
export const reasonsSchema = z.array(reasonSchema);
export type Reason = z.infer<typeof reasonSchema>;

export const pickableSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  /** Null for an ingredient with no unit set yet: it cannot be recorded. */
  unit: z.string().nullable(),
});
export const pickablesSchema = z.array(pickableSchema);
export type Pickable = z.infer<typeof pickableSchema>;

export const entrySchema = z.object({
  id: z.string(),
  item_id: z.string(),
  item: z.string().nullable(),
  item_kind: z.string().nullable(),
  qty: z.number(),
  unit: z.string(),
  reason: z.string(),
  reason_label: z.string(),
  note: z.string().nullable(),
  occurred_on: z.string(),
  photo_document_id: z.string().nullable(),
  entered_by: z.string().nullable(),
  entered_by_name: z.string().nullable(),
  set_by: z.string().nullable(),
  set_by_name: z.string().nullable(),
  changed: z.boolean(),
  /** True when the signed-in person entered it. */
  mine: z.boolean().optional().default(false),
  created_at: z.string(),
});

export const entryDetailSchema = entrySchema.extend({
  photo_url: z.string().nullable(),
  photo_expires_in_seconds: z.number().nullable(),
});
export type WasteEntry = z.infer<typeof entrySchema>;

export const entriesSchema = z.object({
  items: z.array(entrySchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

const reasonLineSchema = z.object({
  reason: z.string(),
  reason_label: z.string(),
  qty: z.number(),
  unit: z.string(),
  qty_text: z.string(),
  entries: z.number(),
  cost_cents: z.number(),
  uncosted_entries: z.number(),
});
const reportItemSchema = z.object({
  item_id: z.string(),
  item: z.string(),
  kind: z.string(),
  cost_cents: z.number(),
  reasons: z.array(reasonLineSchema),
});
const reportWeekSchema = z.object({
  week_start: z.string(),
  week_end: z.string(),
  entries: z.number(),
  cost_cents: z.number(),
  items: z.array(reportItemSchema),
});
export const reportSchema = z.object({
  from: z.string(),
  to: z.string(),
  weeks: z.array(reportWeekSchema),
  totals: z.object({
    entries: z.number(),
    cost_cents: z.number(),
    uncosted_entries: z.number(),
  }),
  uncosted: z.array(
    z.object({
      entry_id: z.string(),
      item_id: z.string(),
      item: z.string(),
      reason: z.string(),
      reason_label: z.string(),
      qty_text: z.string(),
      occurred_on: z.string(),
      why: z.string(),
    }),
  ),
  basis: z.string(),
});
export type WasteReport = z.infer<typeof reportSchema>;

const path = (venueId: string) => ({ params: { path: { venue_id: venueId } } });

export function fetchReasons(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/waste/reasons", path(venueId)),
    reasonsSchema,
    next,
  );
}

export function fetchPickables(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/waste/items", path(venueId)),
    pickablesSchema,
    next,
  );
}

export function fetchEntries(
  token: string,
  venueId: string,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/waste", {
      params: {
        path: { venue_id: venueId },
        query: { limit: PAGE_SIZE, offset },
      },
    }),
    entriesSchema,
    next,
  );
}

export function fetchEntry(
  token: string,
  venueId: string,
  entryId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/waste/{entry_id}", {
      params: { path: { venue_id: venueId, entry_id: entryId } },
    }),
    entryDetailSchema,
    next,
  );
}

export function fetchWasteReport(
  token: string,
  venueId: string,
  range: { from: string; to: string } | null,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/waste/report", {
      params: {
        path: { venue_id: venueId },
        query: range ?? {},
      },
    }),
    reportSchema,
    next,
  );
}
