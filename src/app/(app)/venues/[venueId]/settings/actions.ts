"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

/** Change roster rules. A number becomes a rule's setting; `null` puts a rule back to its default. */
export const saveRosterRules = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    rules: z.record(
      z.string().max(80),
      z.union([z.string().max(40), z.number(), z.boolean(), z.null()]),
    ),
  }),
  async ({ venueId, key, rules }, principal) => {
    if (Object.keys(rules).length === 0) return { done: true }; // nothing differs from what is saved
    const { error, response } = await backend(principal.accessToken).PATCH(
      "/v1/venues/{venue_id}/roster/rules",
      {
        params: { path: { venue_id: venueId } },
        body: { rules } as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/settings`);
    return { done: true };
  },
);

/** Set where the venue is, from the position the owner's browser reads. The backend checks the ranges. */
export const saveLocation = action(
  strictInput({
    venueId: z.uuid(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  async ({ venueId, latitude, longitude }, principal) => {
    const { error, response } = await backend(principal.accessToken).PUT(
      "/v1/venues/{venue_id}/roster/clock/location",
      {
        params: { path: { venue_id: venueId } },
        body: { latitude, longitude },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/settings`);
    return { done: true };
  },
);

/** Change the venue's settings and targets. Only what changed is sent; the backend says whether anything was written. */
export const saveVenueSettings = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    changes: z.strictObject({
      name: z.string().max(200).optional(),
      timezone: z.string().max(80).optional(),
      trading_day_start: z.string().max(5).optional(),
      prime_cost_target_pct: z.number().optional(),
      labour_target_pct: z.number().optional(),
      target_margin_pct: z.number().optional(),
      roster_hours_alert: z.number().optional(),
    }),
  }),
  async ({ venueId, key, changes }, principal) => {
    if (Object.keys(changes).length === 0) return { changed: false };
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/settings",
      {
        params: { path: { venue_id: venueId } },
        body: changes as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/settings`);
    return {
      changed: (data as { changed?: boolean } | undefined)?.changed === true,
    };
  },
);

/** Set opening hours for the days sent; the backend leaves the other days alone. */
export const saveHours = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    days: z
      .array(
        z.strictObject({
          dow: z.number().int().min(0).max(6),
          closed: z.boolean(),
          opens: z.string().max(5).optional(),
          closes: z.string().max(5).optional(),
        }),
      )
      .max(7),
  }),
  async ({ venueId, key, days }, principal) => {
    if (days.length === 0) return { changed: 0 };
    const { data, error, response } = await backend(principal.accessToken).PUT(
      "/v1/venues/{venue_id}/hours",
      {
        params: { path: { venue_id: venueId } },
        body: { days } as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/settings`);
    return {
      changed: (data as { changed?: number } | undefined)?.changed ?? 0,
    };
  },
);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Mark a day as a public holiday, or rename one. */
export const addHoliday = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    date: day,
    name: z.string().min(1).max(100),
  }),
  async ({ venueId, key, date, name }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/holidays",
      {
        params: { path: { venue_id: venueId } },
        body: { date, name } as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/settings`);
    return { done: true };
  },
);

export const removeHoliday = action(
  strictInput({ venueId: z.uuid(), key: z.string(), date: day }),
  async ({ venueId, key, date }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/holidays/{day}/remove",
      {
        params: { path: { venue_id: venueId, day: date } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/settings`);
    return { done: true };
  },
);
