"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const base = { venueId: z.uuid(), key: z.string() };
const cents = z.number().int().min(0).max(100_000_000);

/** Pay and ending a job can wait for the owner's approval: the backend answers 202 and nothing has changed yet. */
function waiting(data: unknown): boolean {
  return (data as { status?: string } | undefined)?.status === "needs_approval";
}

function done(venueId: string) {
  revalidatePath(`/venues/${venueId}/team`);
  revalidatePath(`/venues/${venueId}/changes`);
}

export const addStaff = action(
  strictInput({
    ...base,
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().max(200).optional(),
    positionNames: z.array(z.string().max(80)).max(30),
    hourlyCostCents: cents.optional(),
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          name: input.name,
          email: input.email || null,
          position_names: input.positionNames,
          hourly_cost_cents: input.hourlyCostCents ?? null,
        } as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

/**
 * Change a person. Every field is optional: the backend refuses a pay change that arrives together with other fields
 * once pay needs approval (422 `pay_separate`), so the form sends pay on its own, in its own call.
 */
export const changeStaff = action(
  strictInput({
    ...base,
    staffId: z.string().min(1),
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().max(200).optional(),
    positionNames: z.array(z.string().max(80)).max(30).optional(),
    hourlyCostCents: cents.optional(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/{staff_id}",
      {
        params: { path: { venue_id: input.venueId, staff_id: input.staffId } },
        body: {
          name: input.name,
          email: input.email || undefined,
          position_names: input.positionNames,
          hourly_cost_cents: input.hourlyCostCents,
        } as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { needsApproval: waiting(data) };
  },
);

export const endEmployment = action(
  strictInput({ ...base, staffId: z.string().min(1) }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/{staff_id}/deactivate",
      {
        params: { path: { venue_id: input.venueId, staff_id: input.staffId } },
        body: {} as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { needsApproval: waiting(data) };
  },
);

export const restoreEmployment = action(
  strictInput({ ...base, staffId: z.string().min(1) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/{staff_id}/reactivate",
      {
        params: { path: { venue_id: input.venueId, staff_id: input.staffId } },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

export const addPosition = action(
  strictInput({
    ...base,
    name: z.string().trim().min(1).max(80),
    defaultRateCents: cents,
  }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/positions",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          name: input.name,
          default_rate_cents: input.defaultRateCents,
        } as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

export const inviteStaff = action(
  strictInput({ ...base, staffId: z.string().min(1) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/{staff_id}/invite",
      {
        params: { path: { venue_id: input.venueId, staff_id: input.staffId } },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

export const cancelInvite = action(
  strictInput({ venueId: z.uuid(), inviteId: z.string().min(1) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/invites/{invite_id}/cancel",
      {
        params: {
          path: { venue_id: input.venueId, invite_id: input.inviteId },
        },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId);
    return { done: true };
  },
);

/** Owner or partner: remove a person's authenticator app and recovery codes. `userId` is the person's users.id. */
export const resetSecondFactor = action(
  strictInput({ venueId: z.uuid(), userId: z.uuid() }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/people/{user_id}/second-factor/reset",
      {
        params: { path: { venue_id: input.venueId, user_id: input.userId } },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    return { done: true };
  },
);
