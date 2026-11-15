"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { newIdempotencyKey } from "@/server/api/idempotency";
import { requirePrincipal } from "@/server/auth/principal";
import { type FormState, publicAction } from "@/server/public-action";

/** Say yes to an invite: the person joins the venue in the invited role. */
export const acceptInvite = action(
  strictInput({ id: z.uuid() }),
  async ({ id }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/me/invites/{invite_id}/accept",
      {
        params: { path: { invite_id: id } },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/");
    return { done: true };
  },
);

export const declineInvite = action(
  strictInput({ id: z.uuid() }),
  async ({ id }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/me/invites/{invite_id}/decline",
      {
        params: { path: { invite_id: id } },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/");
    return { done: true };
  },
);

/** Set up a venue; the person who does it becomes its owner. */
export const createVenue = publicAction(
  z.strictObject({
    name: z.string().trim().min(1).max(100),
    key: z.string().max(128).optional(),
  }),
  async (input): Promise<FormState> => {
    const principal = await requirePrincipal();
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues",
      {
        body: { name: input.name } as never, // the other settings keep the backend's defaults
        headers: { "Idempotency-Key": input.key ?? newIdempotencyKey() },
      },
    );
    if (response.status === 429)
      return { message: "You can set up 3 venues a day. Try again tomorrow." };
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/");
    return redirect("/");
  },
);
