import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const noticeSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  issued_list_id: z.string().nullable(),
  created_at: z.string(),
  read: z.boolean(),
  read_at: z.string().nullable().optional(),
});
export type Notice = z.infer<typeof noticeSchema>;

export const noticePageSchema = z.object({
  items: z.array(noticeSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  /** How many of all my notices are unread (not just this page). */
  unread: z.number(),
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
