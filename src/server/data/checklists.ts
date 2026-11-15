import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const KINDS = ["tick", "number", "note", "photo"] as const;

export const itemSchema = z.object({
  item_key: z.string().optional(),
  sort_order: z.number(),
  label: z.string(),
  kind: z.string(),
  required: z.boolean(),
  instruction: z.string().nullish(),
  min_value: z.number().nullish(),
  max_value: z.number().nullish(),
});
export type TemplateItem = z.infer<typeof itemSchema>;

export const templateSchema = z.object({
  template_key: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  starter_key: z.string().nullish(),
  retired: z.boolean(),
  items: z.array(itemSchema).optional(),
});
export type Template = z.infer<typeof templateSchema>;

export const starterSchema = z.object({
  starter_key: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  items: z.array(itemSchema),
});

export const ruleSchema = z.object({
  rule_key: z.string(),
  template_key: z.string(),
  template_name: z.string().nullish(),
  target_kind: z.string(),
  target_value: z.string().nullish(),
  target_name: z.string().nullish(),
  timing_kind: z.string(),
  offset_minutes: z.number().nullish(),
  fixed_time: z.string().nullish(),
  active: z.boolean(),
});
export type Rule = z.infer<typeof ruleSchema>;

const path = (venueId: string) => ({ path: { venue_id: venueId } });
const items = <S extends z.ZodType>(s: S) =>
  z.object({ items: z.array(s) }).transform((p) => p.items);

export function listTemplates(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/workflows/templates", {
      params: { ...path(venueId), query: { limit: 200 } },
    }),
    items(templateSchema),
    next,
  );
}

export function getTemplate(
  token: string,
  venueId: string,
  templateKey: string,
  next: string,
) {
  return read(
    backend(token).GET(
      "/v1/venues/{venue_id}/workflows/templates/{template_key}",
      { params: { path: { venue_id: venueId, template_key: templateKey } } },
    ),
    templateSchema,
    next,
  );
}

export function starterLibrary(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/workflows/library", {
      params: path(venueId),
    }),
    z.array(starterSchema),
    next,
  );
}

export function listRules(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/workflows/rules", {
      params: { ...path(venueId), query: { limit: 200 } },
    }),
    items(ruleSchema),
    next,
  );
}

export const positionSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
});

export function listPositions(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/positions", {
      params: path(venueId),
    }),
    z.array(positionSchema),
    next,
  );
}

export const issuedListSchema = z.object({
  id: z.string(),
  template_key: z.string(),
  name: z.string(),
  staff_ref: z.string().nullish(),
  trading_day: z.string(),
  due_at: z.string(),
  issued_at: z.string().nullish(),
});
export type IssuedList = z.infer<typeof issuedListSchema>;

/**
 * Issued lists by trading day (managers). Without `from` and `to` the backend sends every list, oldest due first.
 * The backend sends no status or progress here, only who and when.
 */
export function issuedLists(
  token: string,
  venueId: string,
  range: { from: string; to: string } | null,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/workflows/lists", {
      params: {
        ...path(venueId),
        query: range ? { ...range, limit: 200 } : { limit: 200 },
      },
    }),
    z.object({ items: z.array(issuedListSchema), total: z.number() }),
    next,
  );
}

/** People's names by staff reference (the issued list sends only the reference). */
export function staffNames(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/staff", {
      params: { ...path(venueId), query: { limit: 200 } },
    }),
    z
      .object({
        items: z.array(z.object({ staff_ref: z.string(), name: z.string() })),
      })
      .transform(
        (p) => new Map(p.items.map((s) => [s.staff_ref, s.name] as const)),
      ),
    next,
  );
}
