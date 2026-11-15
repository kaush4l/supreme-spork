"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const venueId = z.uuid();
const name = z.string().trim().min(1).max(60);

function done(id: string) {
  revalidatePath(`/venues/${id}/team/groups`);
}

export const addGroup = action(
  strictInput({ venueId, key: z.string(), name }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/groups",
      {
        params: { path: { venue_id: input.venueId } },
        body: { name: input.name } as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

export const renameGroup = action(
  strictInput({ venueId, groupId: z.string().min(1), name }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/groups/{group_id}",
      {
        params: {
          path: { venue_id: input.venueId, group_id: input.groupId },
        },
        body: { name: input.name } as never,
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

export const addMember = action(
  strictInput({
    venueId,
    groupId: z.string().min(1),
    staffId: z.string().min(1),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/groups/{group_id}/members",
      {
        params: {
          path: { venue_id: input.venueId, group_id: input.groupId },
        },
        body: { staff_id: input.staffId } as never,
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

export const removeMember = action(
  strictInput({
    venueId,
    groupId: z.string().min(1),
    staffId: z.string().min(1),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/groups/{group_id}/members/{staff_id}/remove",
      {
        params: {
          path: {
            venue_id: input.venueId,
            group_id: input.groupId,
            staff_id: input.staffId,
          },
        },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

/** Retire a group: it leaves the list (the backend keeps its history). */
export const retireGroup = action(
  strictInput({ venueId, groupId: z.string().min(1) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/groups/{group_id}",
      {
        params: {
          path: { venue_id: input.venueId, group_id: input.groupId },
        },
        body: { active: false } as never,
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);
