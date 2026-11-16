"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { isMonday, wallTime } from "./week";

const week = z.string().refine(isMonday);
/** A time from the form: venue-local wall time, checked and sent with no zone so the backend reads it as local. */
const time = z.string().transform((v, ctx) => {
  const t = wallTime(v);
  if (t === null) ctx.addIssue({ code: "custom", message: "Not a time." });
  return t ?? "";
});
const staffId = z.uuid().nullable();
const refresh = (venueId: string) =>
  revalidatePath(`/venues/${venueId}/roster`);

export const addShift = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    position: z.string().min(1),
    staffId,
    start: time,
    end: time,
    breakMinutes: z.number().int().min(0).max(240),
  }),
  async (i, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/shifts",
      {
        params: { path: { venue_id: i.venueId } },
        body: {
          position: i.position,
          staff_id: i.staffId,
          start: i.start,
          end: i.end,
          break_minutes: i.breakMinutes,
        },
        headers: idempotencyHeader(i.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(i.venueId);
    return { done: true };
  },
);

/** Edit or move a shift: only the fields present are sent, so the backend changes only those. */
export const changeShift = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    externalId: z.string().min(1),
    position: z.string().min(1).optional(),
    staffId: staffId.optional(),
    start: time.optional(),
    end: time.optional(),
    breakMinutes: z.number().int().min(0).max(240).optional(),
  }),
  async ({ venueId, key, externalId, ...f }, principal) => {
    const body: Record<string, unknown> = {};
    if (f.position !== undefined) body.position = f.position;
    if (f.staffId !== undefined) body.staff_id = f.staffId;
    if (f.start !== undefined) body.start = f.start;
    if (f.end !== undefined) body.end = f.end;
    if (f.breakMinutes !== undefined) body.break_minutes = f.breakMinutes;
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/shifts/{external_id}",
      {
        params: { path: { venue_id: venueId, external_id: externalId } },
        body,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    return { done: true };
  },
);

export const cancelShift = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    externalId: z.string().min(1),
  }),
  async ({ venueId, key, externalId }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/shifts/{external_id}/cancel",
      {
        params: { path: { venue_id: venueId, external_id: externalId } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    return { done: true };
  },
);

/** Copy the week before into this one (the backend refuses unless this week is empty). */
export const copyLastWeek = action(
  strictInput({ venueId: z.uuid(), key: z.string(), week }),
  async ({ venueId, key, week }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/copy",
      {
        params: { path: { venue_id: venueId } },
        body: { week },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    const copied = (data as { copied?: unknown } | undefined)?.copied;
    return { copied: typeof copied === "number" ? copied : null };
  },
);

const publishedAnswer = z.object({
  version: z.number(),
  unchanged: z.boolean(),
});
const approvalAnswer = z.object({
  status: z.literal("needs_approval"),
  summary: z.string().optional(),
});

/**
 * Publish the week. The backend answers 202 `needs_approval` when the owner made publishing need a second person's
 * approval: nothing is published then, and the screen says so. Otherwise 200 with the version, `unchanged` when there
 * was nothing new.
 */
export const publishWeek = action(
  strictInput({ venueId: z.uuid(), key: z.string(), week }),
  async ({ venueId, key, week }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/publish",
      {
        params: { path: { venue_id: venueId } },
        body: { week },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    if (response.status === 202) {
      const asked = approvalAnswer.safeParse(data);
      return {
        kind: "approval" as const,
        summary: asked.success ? (asked.data.summary ?? null) : null,
        version: null,
        unchanged: false,
      };
    }
    const done = publishedAnswer.safeParse(data);
    if (!done.success) throw toApiFailure(502, null);
    return {
      kind: "published" as const,
      summary: null,
      version: done.data.version,
      unchanged: done.data.unchanged,
    };
  },
);

const offeredAnswer = z.object({
  eligible: z.array(z.string()).optional().default([]),
  told: z.number().optional().default(0),
});

/** Offer an open shift (in a published week) to the people who could work it; the backend tells them. */
export const offerShift = action(
  strictInput({ venueId: z.uuid(), key: z.string(), externalId: z.string() }),
  async ({ venueId, key, externalId }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/shifts/{external_id}/offer",
      {
        params: { path: { venue_id: venueId, external_id: externalId } },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    revalidatePath(`/venues/${venueId}/roster/offers`);
    const a = offeredAnswer.safeParse(data);
    return {
      eligible: a.success ? a.data.eligible : [],
      told: a.success ? a.data.told : 0,
    };
  },
);

/** Take the person off a shift so it is open again. */
export const openShift = action(
  strictInput({ venueId: z.uuid(), externalId: z.string() }),
  async ({ venueId, externalId }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/shifts/{external_id}/open",
      {
        params: { path: { venue_id: venueId, external_id: externalId } },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    return { done: true };
  },
);
