"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const slot = z.object({
  day: z.number().int().min(0).max(13),
  position: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  count: z.number().int().min(1).max(50),
});
const refresh = (venueId: string) =>
  revalidatePath(`/venues/${venueId}/roster/templates`);

const madeAnswer = z.object({ id: z.string() });

export const createTemplate = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    name: z.string().min(1).max(80),
    lengthDays: z.union([z.literal(1), z.literal(7), z.literal(14)]),
    slots: z.array(slot).max(200),
  }),
  async ({ venueId, key, name, lengthDays, slots }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/templates",
      {
        params: { path: { venue_id: venueId } },
        body: { name, length_days: lengthDays, slots },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    const a = madeAnswer.safeParse(data);
    if (!a.success) throw toApiFailure(502, null);
    return { templateId: a.data.id };
  },
);

/** Rename, replace the slots, or retire and restore. Only the fields sent change. */
export const changeTemplate = action(
  strictInput({
    venueId: z.uuid(),
    templateId: z.string(),
    name: z.string().min(1).max(80).optional(),
    slots: z.array(slot).max(200).optional(),
    active: z.boolean().optional(),
  }),
  async ({ venueId, templateId, ...f }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/templates/{template_id}",
      {
        params: { path: { venue_id: venueId, template_id: templateId } },
        body: f,
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId);
    revalidatePath(`/venues/${venueId}/roster/templates/${templateId}`);
    return { done: true };
  },
);

const appliedAnswer = z.object({ created: z.number() });

/** Make the template's open shifts from a start date. Applying twice makes the shifts twice, so the key guards it. */
export const applyTemplate = action(
  strictInput({
    venueId: z.uuid(),
    templateId: z.string(),
    key: z.string(),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  async ({ venueId, templateId, key, start }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/roster/templates/{template_id}/apply",
      {
        params: { path: { venue_id: venueId, template_id: templateId } },
        body: { start },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${venueId}/roster`);
    const a = appliedAnswer.safeParse(data);
    return { created: a.success ? a.data.created : null };
  },
);
