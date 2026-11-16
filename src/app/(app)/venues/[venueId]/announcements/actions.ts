"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const idAnswer = z.object({ id: z.string() });

/** Send an announcement. The key is made when the form is drawn, so a double click sends one. */
export const sendAnnouncement = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(5000),
    audienceKind: z.enum(["everyone", "positions", "groups", "people"]),
    audienceIds: z.array(z.string().max(200)).max(500),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/announcements",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          title: input.title,
          body: input.body,
          audience_kind: input.audienceKind,
          audience_ids: input.audienceIds,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/announcements`);
    return { id: idAnswer.parse(data).id };
  },
);

const remindAnswer = z.object({ reminded: z.number().optional() });

/** Tell again only the people with a login who have not read it. The backend allows one a day (409 `remind_too_soon`). */
export const remindAnnouncement = action(
  strictInput({
    venueId: z.uuid(),
    announcementId: z.uuid(),
    key: z.string(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/announcements/{announcement_id}/remind",
      {
        params: {
          path: {
            venue_id: input.venueId,
            announcement_id: input.announcementId,
          },
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(
      `/venues/${input.venueId}/announcements/${input.announcementId}`,
    );
    return { reminded: remindAnswer.parse(data).reminded ?? 0 };
  },
);

/** Withdraw it: staff see it as withdrawn, without the text. Doing it twice changes nothing. */
export const withdrawAnnouncement = action(
  strictInput({
    venueId: z.uuid(),
    announcementId: z.uuid(),
    key: z.string(),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/announcements/{announcement_id}/withdraw",
      {
        params: {
          path: {
            venue_id: input.venueId,
            announcement_id: input.announcementId,
          },
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/announcements`);
    revalidatePath(
      `/venues/${input.venueId}/announcements/${input.announcementId}`,
    );
    return { done: true };
  },
);
