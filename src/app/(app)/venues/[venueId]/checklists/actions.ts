"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const base = (venueId: string) => `/venues/${venueId}/checklists`;

export const copyStarter = action(
  strictInput({
    venueId: z.uuid(),
    starterKey: z.string().min(1),
    key: z.string(),
  }),
  async ({ venueId, starterKey, key }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/library/{starter_key}/copy",
      {
        params: { path: { venue_id: venueId, starter_key: starterKey } },
        body: {},
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(base(venueId));
    return { done: true };
  },
);

const itemFields = {
  label: z.string(),
  kind: z.enum(["tick", "number", "note", "photo"]),
  required: z.boolean(),
  instruction: z.string().nullable(),
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
};

export const addItem = action(
  strictInput({
    venueId: z.uuid(),
    templateKey: z.string().min(1),
    key: z.string(),
    ...itemFields,
  }),
  async (i, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/templates/{template_key}/items",
      {
        params: { path: { venue_id: i.venueId, template_key: i.templateKey } },
        body: {
          label: i.label,
          kind: i.kind,
          required: i.required,
          instruction: i.instruction,
          min_value: i.minValue,
          max_value: i.maxValue,
        },
        headers: idempotencyHeader(i.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`${base(i.venueId)}/${i.templateKey}`);
    return { done: true };
  },
);

export const changeItem = action(
  strictInput({
    venueId: z.uuid(),
    templateKey: z.string().min(1),
    itemKey: z.string().min(1),
    remove: z.boolean().optional(),
    ...itemFields,
  }),
  async (i, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/templates/{template_key}/items/{item_key}",
      {
        params: {
          path: {
            venue_id: i.venueId,
            template_key: i.templateKey,
            item_key: i.itemKey,
          },
        },
        body: i.remove
          ? { remove: true }
          : {
              remove: false,
              label: i.label,
              kind: i.kind,
              required: i.required,
              instruction: i.instruction,
              min_value: i.minValue,
              max_value: i.maxValue,
            },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`${base(i.venueId)}/${i.templateKey}`);
    return { done: true };
  },
);

export const createRule = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    templateKey: z.string().min(1),
    targetKind: z.enum(["everyone", "position", "person"]),
    position: z.string().optional(),
    staffId: z.string().optional(),
    timingKind: z.enum(["shift_start", "before_shift_end", "fixed_time"]),
    offsetMinutes: z.number().int().min(0).max(1440).optional(),
    fixedTime: z.string().optional(),
  }),
  async (i, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/rules",
      {
        params: { path: { venue_id: i.venueId } },
        body: {
          template_key: i.templateKey,
          target_kind: i.targetKind,
          position: i.targetKind === "position" ? i.position : undefined,
          staff_id: i.targetKind === "person" ? i.staffId : undefined,
          timing_kind: i.timingKind,
          offset_minutes:
            i.timingKind === "before_shift_end" ? i.offsetMinutes : undefined,
          fixed_time: i.timingKind === "fixed_time" ? i.fixedTime : undefined,
        },
        headers: idempotencyHeader(i.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(base(i.venueId));
    return { done: true };
  },
);

export const deactivateRule = action(
  strictInput({ venueId: z.uuid(), ruleKey: z.string().min(1) }),
  async ({ venueId, ruleKey }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/rules/{rule_key}/deactivate",
      { params: { path: { venue_id: venueId, rule_key: ruleKey } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(base(venueId));
    return { done: true };
  },
);

const templateSchema = z.object({ template_key: z.string() });

/** Make a copy of a checklist (with its items). Without a name the backend calls it "<name> copy". */
export const duplicateTemplate = action(
  strictInput({
    venueId: z.uuid(),
    templateKey: z.string().min(1),
    key: z.string(),
    name: z.string().trim().max(120).optional(),
  }),
  async ({ venueId, templateKey, key, name }, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/templates/{template_key}/duplicate",
      {
        params: { path: { venue_id: venueId, template_key: templateKey } },
        body: name ? { name } : {},
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(base(venueId));
    return { templateKey: templateSchema.parse(data).template_key };
  },
);

/** Retire a checklist: no new lists are made from it and it can no longer be changed. */
export const retireTemplate = action(
  strictInput({ venueId: z.uuid(), templateKey: z.string().min(1) }),
  async ({ venueId, templateKey }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/templates/{template_key}/retire",
      { params: { path: { venue_id: venueId, template_key: templateKey } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(base(venueId));
    revalidatePath(`${base(venueId)}/${templateKey}`);
    return { done: true };
  },
);

/** Change who a rule goes to and when. Send only the parts the person set. */
export const changeRule = action(
  strictInput({
    venueId: z.uuid(),
    ruleKey: z.string().min(1),
    targetKind: z.enum(["everyone", "position", "person"]),
    position: z.string().optional(),
    staffId: z.string().optional(),
    timingKind: z.enum(["shift_start", "before_shift_end", "fixed_time"]),
    offsetMinutes: z.number().int().min(0).max(1440).optional(),
    fixedTime: z.string().optional(),
  }),
  async (i, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/workflows/rules/{rule_key}",
      {
        params: { path: { venue_id: i.venueId, rule_key: i.ruleKey } },
        body: {
          target_kind: i.targetKind,
          position: i.targetKind === "position" ? i.position : undefined,
          staff_id: i.targetKind === "person" ? i.staffId : undefined,
          timing_kind: i.timingKind,
          offset_minutes:
            i.timingKind === "before_shift_end" ? i.offsetMinutes : undefined,
          fixed_time: i.timingKind === "fixed_time" ? i.fixedTime : undefined,
        },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(base(i.venueId));
    return { done: true };
  },
);
