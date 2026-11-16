import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** One follow-up (a corrective action) as the backend sends it. */
export const actionSchema = z.object({
  id: z.string(),
  /** out_of_range or list_missed */
  kind: z.string(),
  title: z.string(),
  detail: z.string().nullish(),
  issued_list_id: z.string().nullish(),
  item_key: z.string().nullish(),
  finding_id: z.string().nullish(),
  source_key: z.string().nullish(),
  owner_user_id: z.string().nullish(),
  owner_name: z.string().nullish(),
  due_at: z.string(),
  /** The server's clock decides this, never the browser's. */
  overdue: z.boolean(),
  /** open, done or cancelled */
  state: z.string(),
  note: z.string().nullish(),
  decided_by: z.string().nullish(),
  decided_by_name: z.string().nullish(),
  decided_at: z.string().nullish(),
  raised_at: z.string(),
});
export type CorrectiveAction = z.infer<typeof actionSchema>;

const pageSchema = z.object({
  items: z.array(actionSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});
export type ActionsPage = z.infer<typeof pageSchema>;

export type ActionState = "open" | "done" | "cancelled" | "all";

/** One page of follow-ups: open first (overdue, then soonest), closed ones newest first. */
export function listActions(
  token: string,
  venueId: string,
  state: ActionState,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/corrective-actions", {
      params: {
        path: { venue_id: venueId },
        query: { state, limit: 25, offset },
      },
    }),
    pageSchema,
    next,
  );
}

export function getAction(
  token: string,
  venueId: string,
  actionId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/corrective-actions/{action_id}", {
      params: { path: { venue_id: venueId, action_id: actionId } },
    }),
    actionSchema,
    next,
  );
}

const ownersSchema = z
  .object({
    items: z.array(z.object({ user_id: z.string(), name: z.string() })),
  })
  .transform((p) => p.items);
export type OwnerChoice = z.infer<typeof ownersSchema>[number];

/** The people who may own a follow-up here (owner, partner or manager of the venue), sorted by name. */
export function listOwners(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/corrective-actions/owners", {
      params: { path: { venue_id: venueId } },
    }),
    ownersSchema,
    next,
  );
}
