"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const ids = {
  venueId: z.uuid(),
  documentId: z.uuid(),
  key: z.string(),
};

const cents = z.number().int().min(0).max(100_000_000);

function refresh(venueId: string, documentId: string) {
  revalidatePath(`/venues/${venueId}/dockets`);
  revalidatePath(`/venues/${venueId}/dockets/${documentId}`);
}

/** Accept a flagged docket as read: its purchases are booked. */
export const approveDocket = action(
  strictInput({ ...ids, note: z.string().trim().max(500).optional() }),
  async ({ venueId, documentId, key, note }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/dockets/{document_id}/approve",
      {
        params: { path: { venue_id: venueId, document_id: documentId } },
        body: { note: note || null },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, documentId);
    return { done: true };
  },
);

/** Set a docket aside: nothing is booked. The reason is required. */
export const rejectDocket = action(
  strictInput({ ...ids, reason: z.string().trim().min(1).max(500) }),
  async ({ venueId, documentId, key, reason }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/dockets/{document_id}/reject",
      {
        params: { path: { venue_id: venueId, document_id: documentId } },
        body: { reason },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, documentId);
    return { done: true };
  },
);

/** Correct a docket: a new version replaces the old one. Only the fields sent change. */
export const changeDocket = action(
  strictInput({
    ...ids,
    supplier: z.string().trim().min(1).max(200).optional(),
    delivery_date: z.string().trim().min(1).max(20).optional(),
    invoice_no: z.string().trim().min(1).max(100).optional(),
    total_cents: cents.optional(),
    lines: z.record(
      z.string().regex(/^\d{1,3}$/),
      z.strictObject({
        description: z.string().trim().min(1).max(300).optional(),
        qty: z.number().positive().max(1_000_000).optional(),
        unit_price_cents: cents.optional(),
        total_cents: cents.optional(),
      }),
    ),
    drop_lines: z.array(z.number().int().min(1).max(500)).max(500),
    note: z.string().trim().max(500).optional(),
  }),
  async ({ venueId, documentId, key, note, ...changes }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/dockets/{document_id}/change",
      {
        params: { path: { venue_id: venueId, document_id: documentId } },
        body: { ...changes, note: note || null } as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, documentId);
    return { done: true };
  },
);

/** Key in a docket nobody has read. Lines that do not add up come back as a field error and store nothing. */
export const keyInDocket = action(
  strictInput({
    ...ids,
    supplier: z.string().trim().min(1).max(200).optional(),
    delivery_date: z.string().trim().max(20),
    invoice_no: z.string().trim().min(1).max(100).optional(),
    total_cents: cents.optional(),
    lines: z
      .array(
        z.strictObject({
          description: z.string().trim().max(300),
          qty: z.number().positive().max(1_000_000).optional(),
          unit_text: z.string().trim().min(1).max(40).optional(),
          unit_price_cents: cents.optional(),
          total_cents: cents.optional(),
        }),
      )
      .max(200),
  }),
  async ({ venueId, documentId, key, ...body }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/dockets/{document_id}/lines",
      {
        params: { path: { venue_id: venueId, document_id: documentId } },
        body: body as never,
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    refresh(venueId, documentId);
    return { done: true };
  },
);
