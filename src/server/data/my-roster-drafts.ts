import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** My answer to one shift of a draft. `decision` is null until the manager decides a proposal or a pick-up. */
export const draftReplySchema = z.object({
  id: z.string(),
  external_id: z.string(),
  response: z.string(),
  reason: z.string().nullable().optional(),
  proposed_start: z.string().nullable().optional(),
  proposed_end: z.string().nullable().optional(),
  decision: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  source: z.string().optional(),
  at: z.string().optional(),
});
export type DraftReply = z.infer<typeof draftReplySchema>;

export const draftShiftSchema = z.object({
  external_id: z.string(),
  status: z.string(),
  position: z.string().nullable(),
  start: z.string(),
  end: z.string(),
  break_minutes: z.number(),
  hours: z.number().nullable().optional(),
  reply: draftReplySchema.nullable(),
});
export type DraftShift = z.infer<typeof draftShiftSchema>;

export const myDraftSchema = z.object({
  id: z.string(),
  /** The Monday of the week, `2026-11-16`. */
  week_start: z.string(),
  state: z.string(),
  /** null when the venue gives no reply deadline. */
  reply_by: z.string().nullable(),
  created_at: z.string(),
  my_shifts: z.array(draftShiftSchema),
  open_shifts: z.array(draftShiftSchema),
  may_propose: z.boolean(),
  may_pick_up: z.boolean(),
});
export type MyDraft = z.infer<typeof myDraftSchema>;

/** Draft rosters out for my reply: my shifts with my answers, and the open shifts I may pick up. Newest first. */
export function myRosterDrafts(
  accessToken: string,
  venueId: string,
  next: string,
): Promise<MyDraft[]> {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/me/roster/drafts", {
      params: { path: { venue_id: venueId } },
    }),
    z.array(myDraftSchema),
    next,
  );
}
