import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const changeRequestSchema = z.object({
  id: z.string(),
  action: z.string(),
  capability: z.string(),
  summary: z.string(),
  /** pending, approved, rejected, withdrawn, applied, failed or stale */
  status: z.string(),
  status_label: z.string(),
  requested_by: z.string().nullable(),
  requested_by_name: z.string().nullable().optional(),
  requested_at: z.string(),
  decided_by: z.string().nullable(),
  decided_by_name: z.string().nullable().optional(),
  decided_at: z.string().nullable(),
  note: z.string().nullable(),
  result: z.unknown().optional(),
  target_ref: z.string().nullable().optional(),
});
export type ChangeRequest = z.infer<typeof changeRequestSchema>;

export function listChangeRequests(
  token: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/change-requests", {
      params: { path: { venue_id: venueId } },
    }),
    z.object({ items: z.array(changeRequestSchema) }).transform((p) => p.items),
    next,
  );
}

/** The rules listing again, this time for the approval fields the rules page does not read. */
export const approvalListingSchema = z.object({
  approval_levels: z.array(z.string()),
  items: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      help: z.string(),
      approvable: z.boolean().optional(),
      approval: z.string().optional(),
    }),
  ),
});
export type ApprovalListing = z.infer<typeof approvalListingSchema>;

export function approvalListing(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/permissions", {
      params: { path: { venue_id: venueId } },
    }),
    approvalListingSchema,
    next,
  );
}

const ACTION_WORDS: Record<string, string> = {
  "staff.pay": "Change pay",
  "staff.end": "End employment",
  "certificates.record": "Record a certificate",
  "roster.publish": "Publish the roster",
};

/** A plain name for what was asked; an action we do not know is shown as it came, tidied. */
export function actionWords(action: string): string {
  return ACTION_WORDS[action] ?? action.replace(/[._]/g, " ");
}
