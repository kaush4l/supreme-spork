import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/**
 * The manager side of the roster beyond the grid: offers, staffing templates, suggestions, drafts and history.
 * Every shape was checked against a real answer. The cost per hour the backend sends with each shift is left out on
 * purpose (zod drops what is not named): these screens never show pay.
 */

const q = (venueId: string) => ({ path: { venue_id: venueId } });

/** A shift as `shift_out` sends it. */
export const shiftSchema = z.object({
  external_id: z.string(),
  status: z.string(),
  staff_ref: z.string().nullable().optional(),
  staff_name: z.string().nullable().optional(),
  position: z.string().nullable(),
  start: z.string(),
  end: z.string(),
  break_minutes: z.number().optional().default(0),
  hours: z.number().nullable().optional(),
});
export type ShiftBrief = z.infer<typeof shiftSchema>;

// ------------------------------------------------------------------ offers
export const claimSchema = z.object({
  id: z.string(),
  staff_ref: z.string(),
  name: z.string(),
  decision: z.string().nullable(),
  note: z.string().nullable().optional(),
  at: z.string(),
});
export type Claim = z.infer<typeof claimSchema>;

export const offerSchema = z.object({
  id: z.string(),
  kind: z.string(),
  mode: z.string(),
  status: z.string(),
  shift: shiftSchema,
  offered_by: z.string().nullable().optional(),
  filled_by: z.string().nullable().optional(),
  created_at: z.string(),
  decided_at: z.string().nullable().optional(),
  decided_by_name: z.string().nullable().optional(),
  claims: z.array(claimSchema).optional().default([]),
});
export type Offer = z.infer<typeof offerSchema>;

const offersSchema = z
  .object({ items: z.array(offerSchema) })
  .transform((a) => a.items);

/** `GET /roster/offers`: open offers with who asked. With `decidedWithinDays`, the ones settled in that time instead. */
export function rosterOffers(
  accessToken: string,
  venueId: string,
  next: string,
  decidedWithinDays?: number,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster/offers", {
      params: {
        path: q(venueId).path,
        query:
          decidedWithinDays === undefined
            ? {}
            : { decided_within_days: decidedWithinDays },
      },
    }),
    offersSchema,
    next,
  );
}

// ------------------------------------------------------------------ templates
export const slotSchema = z.object({
  day: z.number(),
  position: z.string(),
  start: z.string(),
  end: z.string(),
  count: z.number(),
});
export type TemplateSlot = z.infer<typeof slotSchema>;

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  length_days: z.number(),
  slots: z.array(slotSchema),
  active: z.boolean(),
  people_per_day: z.array(z.number()),
});
export type RosterTemplate = z.infer<typeof templateSchema>;

const templatesSchema = z
  .object({ items: z.array(templateSchema) })
  .transform((a) => a.items);

export function rosterTemplates(
  accessToken: string,
  venueId: string,
  next: string,
  retired = false,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster/templates", {
      params: { path: q(venueId).path, query: { retired } },
    }),
    templatesSchema,
    next,
  );
}

export function rosterTemplate(
  accessToken: string,
  venueId: string,
  templateId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/roster/templates/{template_id}",
      { params: { path: { venue_id: venueId, template_id: templateId } } },
    ),
    templateSchema,
    next,
  );
}

// ------------------------------------------------------------------ suggestions
export const candidateSchema = z.object({
  staff_id: z.string(),
  name: z.string(),
  group: z.string().nullable().optional(),
  hours_this_week: z.number().optional().default(0),
  reasons: z.array(z.string()).optional().default([]),
});
export type Candidate = z.infer<typeof candidateSchema>;

export const suggestionsSchema = z.object({
  week_start: z.string(),
  open_shifts: z.number(),
  items: z.array(
    z.object({
      shift: shiftSchema,
      candidates: z.array(candidateSchema),
      skipped: z.array(
        z.object({
          staff_id: z.string(),
          name: z.string(),
          reasons: z.array(z.string()),
        }),
      ),
    }),
  ),
});
export type Suggestions = z.infer<typeof suggestionsSchema>;

export function rosterSuggestions(
  accessToken: string,
  venueId: string,
  week: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/roster/weeks/{week}/suggestions",
      { params: { path: { venue_id: venueId, week } } },
    ),
    suggestionsSchema,
    next,
  );
}

// ------------------------------------------------------------------ drafts
const rulesSchema = z.record(z.string(), z.unknown());

export const replySchema = z.object({
  id: z.string(),
  external_id: z.string(),
  staff_ref: z.string(),
  response: z.string(),
  reason: z.string().nullable().optional(),
  proposed_start: z.string().nullable().optional(),
  proposed_end: z.string().nullable().optional(),
  decision: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  at: z.string(),
});
export type Reply = z.infer<typeof replySchema>;

/** `GET /roster/drafts/{id}/board`. `state` is `open`, `published` or `cancelled`. */
export const draftBoardSchema = z.object({
  id: z.string(),
  week_start: z.string(),
  state: z.string(),
  reply_by: z.string().nullable(),
  rules: rulesSchema.optional().default({}),
  created_at: z.string(),
  counts: z.object({
    accepted: z.number(),
    declined: z.number(),
    proposals: z.number(),
    pickups: z.number(),
    no_reply: z.number(),
  }),
  shifts: z.array(
    z.object({
      shift: shiftSchema,
      name: z.string().nullable().optional(),
      reply: replySchema.nullable(),
    }),
  ),
  pickups: z.array(
    z.object({
      shift: shiftSchema,
      claims: z.array(replySchema.extend({ name: z.string() })),
    }),
  ),
});
export type DraftBoard = z.infer<typeof draftBoardSchema>;

export function rosterDraftBoard(
  accessToken: string,
  venueId: string,
  draftId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/roster/drafts/{draft_id}/board",
      { params: { path: { venue_id: venueId, draft_id: draftId } } },
    ),
    draftBoardSchema,
    next,
  );
}

// ------------------------------------------------------------------ history
const changeBrief = z.object({
  external_id: z.string(),
  staff_name: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  start: z.string(),
  end: z.string(),
});
export type ChangeBrief = z.infer<typeof changeBrief>;

export const versionSchema = z.object({
  version: z.number(),
  published_at: z.string(),
  shift_count: z.number(),
  changes: z
    .object({
      added: z.array(changeBrief).optional().default([]),
      changed: z.array(changeBrief).optional().default([]),
      removed: z.array(changeBrief).optional().default([]),
    })
    .nullable()
    .optional(),
});
export type RosterVersion = z.infer<typeof versionSchema>;

export function rosterHistory(
  accessToken: string,
  venueId: string,
  week: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster/history", {
      params: { path: q(venueId).path, query: { week } },
    }),
    z.array(versionSchema),
    next,
  );
}

// ------------------------------------------------------------------ the list of drafts
export const draftItemSchema = z.object({
  id: z.string(),
  week_start: z.string(),
  state: z.string(),
  reply_by: z.string().nullable(),
  created_at: z.string(),
});
export type DraftItem = z.infer<typeof draftItemSchema>;

/** `GET /roster/drafts`: drafts sent to staff, newest first. `state` is `open`, `published` or `cancelled`. */
export function rosterDrafts(
  accessToken: string,
  venueId: string,
  next: string,
  filter: { week?: string; state?: string } = {},
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster/drafts", {
      params: {
        path: q(venueId).path,
        query: {
          ...(filter.week ? { week: filter.week } : {}),
          ...(filter.state ? { state: filter.state } : {}),
        } as never,
      },
    }),
    z.array(draftItemSchema),
    next,
  );
}
