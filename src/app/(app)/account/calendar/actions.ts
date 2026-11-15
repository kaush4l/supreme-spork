"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { calendarAddress } from "@/server/data/person-text";
import { env } from "@/server/env";

const made = z.object({ path: z.string() });

/**
 * Make the calendar link, or replace it (the old one stops working at once). The backend keeps only a hash, so the
 * address comes back this once and is never stored by the UI: it goes straight to the browser in this answer.
 */
export const makeCalendarLink = action(
  strictInput({}),
  async (_input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/me/calendar",
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    const parsed = made.safeParse(data);
    if (!parsed.success)
      throw toApiFailure(502, { error: { message: "Unexpected answer." } });
    revalidatePath("/account/calendar");
    return { address: calendarAddress(env().BACKEND_URL, parsed.data.path) };
  },
);

export const revokeCalendarLink = action(
  strictInput({}),
  async (_input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/me/calendar/revoke",
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/account/calendar");
    return { revoked: true };
  },
);
