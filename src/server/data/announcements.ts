import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** One person an announcement was meant for: read, unread, or no_login (no app login, so nobody was told). */
export const receiptSchema = z.object({
  staff_ref: z.string(),
  name: z.string(),
  state: z.string(),
  told_at: z.string().nullish(),
  read_at: z.string().nullish(),
});
export type Receipt = z.infer<typeof receiptSchema>;

/** A row of the manager's list; the detail answer adds `people` and `reminders`. */
export const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().nullish(),
  audience_kind: z.string(),
  audience_ids: z.array(z.string()).default([]),
  /** Words for the audience (position names, group names, people), as the backend works them out. */
  audience_labels: z.array(z.string()).default([]),
  expires_at: z.string().nullish(),
  status: z.string(),
  created_by_name: z.string().nullish(),
  sent_at: z.string(),
  withdrawn_at: z.string().nullish(),
  recipient_count: z.number(),
  told_count: z.number(),
  read_count: z.number(),
  unread_count: z.number(),
  no_login_count: z.number(),
  reminders_sent: z.number(),
  last_reminded_on: z.string().nullish(),
  can_remind: z.boolean(),
});
export type AnnouncementRow = z.infer<typeof announcementSchema>;

export const announcementDetailSchema = announcementSchema.extend({
  people: z.array(receiptSchema),
  reminders: z.array(
    z.object({ day: z.string(), notified: z.number(), at: z.string() }),
  ),
});
export type AnnouncementDetail = z.infer<typeof announcementDetailSchema>;

const listSchema = z.object({
  items: z.array(announcementSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

/** What a staff member sees of one announcement. A withdrawn one has no `body`. */
export const myAnnouncementSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().nullish(),
  status: z.string(),
  sent_at: z.string(),
  expires_at: z.string().nullish(),
  read: z.boolean(),
  read_at: z.string().nullish(),
});
export type MyAnnouncement = z.infer<typeof myAnnouncementSchema>;

const myListSchema = z.object({
  items: z.array(myAnnouncementSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  /** The active ones not read yet. */
  unread: z.number(),
});

export const ANNOUNCEMENT_PAGE_SIZE = 50;

/** Needs `announcements.send`. Newest first; `status` is all, active, withdrawn or expired. */
export function listAnnouncements(
  token: string,
  venueId: string,
  status: string,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/announcements", {
      params: {
        path: { venue_id: venueId },
        query: { status, limit: ANNOUNCEMENT_PAGE_SIZE, offset },
      },
    }),
    listSchema,
    next,
  );
}

/** Needs `announcements.send`. The announcement with who was told, who has read it and when. */
export function getAnnouncement(
  token: string,
  venueId: string,
  announcementId: string,
  next: string,
) {
  return read(
    backend(token).GET(
      "/v1/venues/{venue_id}/announcements/{announcement_id}",
      {
        params: {
          path: { venue_id: venueId, announcement_id: announcementId },
        },
      },
    ),
    announcementDetailSchema,
    next,
  );
}

/** Any member of the venue: the announcements this person was told. */
export function myAnnouncements(
  token: string,
  venueId: string,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/me/announcements", {
      params: {
        path: { venue_id: venueId },
        query: { limit: ANNOUNCEMENT_PAGE_SIZE, offset },
      },
    }),
    myListSchema,
    next,
  );
}

/** Opening it marks it read for this person (the backend does that; a withdrawn one is not marked). */
export function myAnnouncement(
  token: string,
  venueId: string,
  announcementId: string,
  next: string,
) {
  return read(
    backend(token).GET(
      "/v1/venues/{venue_id}/me/announcements/{announcement_id}",
      {
        params: {
          path: { venue_id: venueId, announcement_id: announcementId },
        },
      },
    ),
    myAnnouncementSchema,
    next,
  );
}
