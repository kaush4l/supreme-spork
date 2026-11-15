import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const findingSchema = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  week_start: z.string(),
  narration: z.string().nullable(),
  value_cents: z.number().nullable(),
  value_pct: z.number().nullable(),
  confidence: z.number().nullable(),
  status: z.string(),
  status_label: z.string(),
  status_help: z.string(),
  sources: z.record(z.string(), z.number()),
  created_at: z.string(),
});
export type Finding = z.infer<typeof findingSchema>;

export const findingDetailSchema = findingSchema.extend({
  current: z.boolean(),
  facts: z.unknown().nullish(),
});

const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  });

export const findingsPageSchema = pageOf(findingSchema);

export const sourcesSchema = pageOf(z.record(z.string(), z.unknown())).extend({
  group: z.string(),
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
});

export const messageRowSchema = z.object({
  id: z.string(),
  template: z.string(),
  channel: z.string(),
  sent_at: z.string().nullable(),
  status: z.string(),
  title: z.string().nullable(),
  finding_count: z.number(),
});
export const messagesPageSchema = pageOf(messageRowSchema);

export const messageSchema = messageRowSchema
  .omit({ finding_count: true })
  .extend({
    body: z.string().nullable(),
    finding_ids: z.array(z.string()),
    sections: z.array(
      z.object({
        title: z.string(),
        items: z.array(
          z.object({
            number: z.number(),
            text: z.string(),
            finding_id: z.string().nullable(),
          }),
        ),
      }),
    ),
  });

const at = (venueId: string) => ({ venue_id: venueId });

/** One week of findings (`week` is a Monday), or the newest ones first when no week is given. */
export function fetchFindings(
  token: string,
  venueId: string,
  week: string | undefined,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/findings", {
      params: {
        path: at(venueId),
        query: { ...(week ? { week } : {}), limit: 50, offset },
      },
    }),
    findingsPageSchema,
    next,
  );
}

export const findingWeeksSchema = z.object({
  current_week: z.string(),
  weeks: z.array(z.object({ week_start: z.string(), count: z.number() })),
});

export function fetchFindingWeeks(
  token: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/findings/weeks", {
      params: { path: at(venueId) },
    }),
    findingWeeksSchema,
    next,
  );
}

export function fetchFinding(
  token: string,
  venueId: string,
  id: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/findings/{finding_id}", {
      params: { path: { ...at(venueId), finding_id: id } },
    }),
    findingDetailSchema,
    next,
  );
}

export const PAGE = 20;

export function fetchSources(
  token: string,
  venueId: string,
  id: string,
  group: string,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/findings/{finding_id}/sources", {
      params: {
        path: { ...at(venueId), finding_id: id },
        query: { group, limit: PAGE, offset },
      },
    }),
    sourcesSchema,
    next,
  );
}

export function fetchMessages(
  token: string,
  venueId: string,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/messages", {
      params: { path: at(venueId), query: { limit: 30, offset } },
    }),
    messagesPageSchema,
    next,
  );
}

export function fetchMessage(
  token: string,
  venueId: string,
  id: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/messages/{message_id}", {
      params: { path: { ...at(venueId), message_id: id } },
    }),
    messageSchema,
    next,
  );
}
