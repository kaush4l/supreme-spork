import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** One thing that wants a person's action, as `GET /attention` sends it. The words, order and severity are the backend's. */
export const attentionItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  key: z.string(),
  title: z.string(),
  text: z.string(),
  count: z.number(),
  effect_cents: z.number().nullable(),
  effect_note: z.string().nullable(),
  severity: z.string(),
  who: z.array(z.string()),
  right: z.string().nullable(),
  /** An ISO time or a plain date (YYYY-MM-DD) when the cause began or falls due; null when the source does not know. */
  since: z.string().nullable(),
  /** What `since` is: `waiting` (a wait that began), `due` (a due date) or `expires` (an expiry date); null when `since` is null. */
  since_kind: z.string().nullish(),
  target: z.object({ kind: z.string(), id: z.string().nullish() }),
  where: z.string().nullish(),
});
export type AttentionItem = z.infer<typeof attentionItemSchema>;

export const attentionSchema = z.object({
  day: z.string(),
  generated_at: z.string(),
  total: z.number(),
  truncated: z.boolean().optional(),
  items: z.array(attentionItemSchema),
});
export type Attention = z.infer<typeof attentionSchema>;

export function fetchAttention(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/attention", {
      params: { path: { venue_id: venueId }, query: {} },
    }),
    attentionSchema,
    next,
  );
}
