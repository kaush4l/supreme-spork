import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const expiryItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  kind_label: z.string(),
  /** venue or person (a person item is an HR file) */
  scope: z.string(),
  staff_ref: z.string().nullable(),
  staff_name: z.string().nullish(),
  title: z.string(),
  reference: z.string().nullable(),
  expires_on: z.string(),
  warn_days: z.number().nullable(),
  lead_days: z.number().nullable().optional(),
  /** expired, expiring or ok */
  status: z.string(),
  status_label: z.string(),
  status_help: z.string(),
  days_left: z.number(),
  document_id: z.string().nullable(),
  note: z.string().nullable(),
  changed: z.boolean().optional(),
});
export type ExpiryItem = z.infer<typeof expiryItemSchema>;

export const kindSchema = z.object({
  code: z.string(),
  label: z.string(),
  scope: z.string(),
  default_warn_days: z.number(),
});
export type ExpiryKind = z.infer<typeof kindSchema>;

const path = (venueId: string) => ({ params: { path: { venue_id: venueId } } });

export function listExpiryItems(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/expiry-items", {
      params: { path: { venue_id: venueId }, query: { limit: 200 } },
    }),
    z.object({ items: z.array(expiryItemSchema) }).transform((p) => p.items),
    next,
  );
}

export function getExpiryItem(
  token: string,
  venueId: string,
  itemId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/expiry-items/{item_id}", {
      params: { path: { venue_id: venueId, item_id: itemId } },
    }),
    expiryItemSchema,
    next,
  );
}

export function listExpiryKinds(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/expiry-kinds", path(venueId)),
    z.array(kindSchema),
    next,
  );
}

const staffNameSchema = z.object({
  staff_ref: z.string().nullable().optional(),
  name: z.string(),
  active: z.boolean(),
});

/** The people an HR item can be for (the add form's picker). Only asked for by someone with `hr.files.view`. */
export function listPeople(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/staff", {
      params: { path: { venue_id: venueId }, query: { limit: 200 } },
    }),
    z.object({ items: z.array(staffNameSchema) }).transform((p) => p.items),
    next,
  );
}

export const fileLinkSchema = z.object({
  file_url: z.string(),
  filename: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
});
