"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";

const count = z.number().catch(0);
const madeSchema = z.object({
  week_start: z.string().catch(""),
  shifts: count,
  issued: count,
  already_issued: count,
});

/**
 * Give out the lists the rules ask for to the filled shifts of one published roster week (a Monday).
 * Lists already given out are not made again, so repeating it adds nothing.
 */
export const issueNow = action(
  strictInput({
    venueId: z.uuid(),
    week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  async ({ venueId, week }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/issue",
      { params: { path: { venue_id: venueId } }, body: { week } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/checklists/issued`);
    revalidatePath(`/venues/${venueId}/board`);
    const made = madeSchema.parse(data ?? {});
    return {
      weekStart: made.week_start || week,
      shifts: made.shifts,
      issued: made.issued,
      alreadyIssued: made.already_issued,
    };
  },
);
