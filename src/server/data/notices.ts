import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** Whether a notice still needs the person. `label` says why not, in words ("Taken by someone else at 2:05 pm"). */
export const noticeStateSchema = z.object({
  live: z.boolean(),
  label: z.string().nullish(),
  since: z.string().nullish(),
});
export type NoticeState = z.infer<typeof noticeStateSchema>;

/** What a notice opens: offer, roster_draft, roster_request, checklist, change_request, shift or none. */
export const noticeTargetSchema = z.object({
  kind: z.string(),
  id: z.string().nullish(),
});
export type NoticeTarget = z.infer<typeof noticeTargetSchema>;

export const noticeSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  issued_list_id: z.string().nullable(),
  created_at: z.string(),
  read: z.boolean(),
  read_at: z.string().nullable().optional(),
  // nullish so an older answer without them still parses (the notice is then taken as live)
  state: noticeStateSchema.nullish(),
  target: noticeTargetSchema.nullish(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const noticePageSchema = z.object({
  items: z.array(noticeSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  /** How many of all my notices are unread (not just this page). */
  unread: z.number(),
  /** How many of all my notices are unread and still live: the number to show. Older answers lack it. */
  live_unread: z.number().nullish(),
});

export const NOTICE_PAGE_SIZE = 20;

export function myNotices(
  accessToken: string,
  venueId: string,
  offset: number,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/workflows/notifications", {
      params: {
        path: { venue_id: venueId },
        query: { limit: NOTICE_PAGE_SIZE, offset },
      },
    }),
    noticePageSchema,
    next,
  );
}
