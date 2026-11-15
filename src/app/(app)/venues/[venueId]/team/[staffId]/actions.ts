"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const person = {
  venueId: z.uuid(),
  staffId: z.string().min(1),
};
const kind = z.enum(["rsa", "food_safety", "first_aid", "other"]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

function done(venueId: string, staffId: string) {
  revalidatePath(`/venues/${venueId}/team/${staffId}`);
  revalidatePath(`/venues/${venueId}/team`);
}

/** Record or correct a certificate. Can wait for the owner's approval (202, nothing changed yet). */
export const recordCertificate = action(
  strictInput({
    ...person,
    kind,
    expiresOn: day,
    number: z.string().trim().max(200).optional(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).PUT(
      "/v1/venues/{venue_id}/staff/{staff_id}/certificates/{kind}",
      {
        params: {
          path: {
            venue_id: input.venueId,
            staff_id: input.staffId,
            kind: input.kind,
          },
        },
        body: {
          expires_on: input.expiresOn,
          number: input.number || null,
        } as never,
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId, input.staffId);
    const waiting =
      (data as { status?: string } | undefined)?.status === "needs_approval";
    return { needsApproval: waiting };
  },
);

export const checkCertificate = action(
  strictInput({ ...person, kind }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/{staff_id}/certificates/{kind}/check",
      {
        params: {
          path: {
            venue_id: input.venueId,
            staff_id: input.staffId,
            kind: input.kind,
          },
        },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId, input.staffId);
    return { done: true };
  },
);

export const unlinkPerson = action(
  strictInput(person),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/{staff_id}/unlink",
      {
        params: { path: { venue_id: input.venueId, staff_id: input.staffId } },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId, input.staffId);
    return { done: true };
  },
);

export const addAvailability = action(
  strictInput({
    ...person,
    key: z.string(),
    entry: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("weekly"),
        weekday: z.number().int().min(0).max(6),
        fromTime: time,
        toTime: time,
        available: z.boolean(),
        note: z.string().trim().max(200).optional(),
      }),
      z.object({
        kind: z.literal("once"),
        startDate: day,
        endDate: day,
        available: z.boolean(),
        note: z.string().trim().max(200).optional(),
      }),
    ]),
  }),
  async (input, principal) => {
    const e = input.entry;
    const body =
      e.kind === "weekly"
        ? {
            kind: "weekly",
            weekday: e.weekday,
            from_time: e.fromTime,
            to_time: e.toTime,
            available: e.available,
            note: e.note || null,
          }
        : {
            kind: "once",
            start_date: e.startDate,
            end_date: e.endDate,
            available: e.available,
            note: e.note || null,
          };
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/{staff_id}/availability",
      {
        params: { path: { venue_id: input.venueId, staff_id: input.staffId } },
        body: body as never,
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId, input.staffId);
    return { done: true };
  },
);

export const removeAvailability = action(
  strictInput({ ...person, rowId: z.string().min(1) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/staff/{staff_id}/availability/{row_id}/remove",
      {
        params: {
          path: {
            venue_id: input.venueId,
            staff_id: input.staffId,
            row_id: input.rowId,
          },
        },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    done(input.venueId, input.staffId);
    return { done: true };
  },
);
