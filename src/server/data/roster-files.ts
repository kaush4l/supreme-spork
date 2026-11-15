import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const rosterFileSummarySchema = z.object({
  document_id: z.string(),
  filename: z.string().nullish(),
  received_at: z.string(),
  status: z.string(),
  label: z.string(),
  help: z.string(),
  shifts_read: z.number(),
  reasons: z.array(z.string()),
});
export type RosterFile = z.infer<typeof rosterFileSummarySchema>;

export const rosterFileDetailSchema = rosterFileSummarySchema.extend({
  shifts: z.array(
    z.object({
      line: z.number(),
      shift_id: z.string().nullish(),
      staff_ref: z.string().nullish(),
      staff_name: z.string().nullish(),
      role: z.string().nullish(),
      status: z.string().nullish(),
      start: z.string().nullish(),
      end: z.string().nullish(),
    }),
  ),
  shifts_total: z.number(),
  shifts_shown: z.number(),
  people_not_in_staff_list: z.array(
    z.object({ staff_ref: z.string(), name: z.string().nullish() }),
  ),
  file_url: z.string().nullish(),
  file_expires_in_seconds: z.number().nullish(),
});
export type RosterFileDetail = z.infer<typeof rosterFileDetailSchema>;

export function fetchRosterFileQueue(
  accessToken: string,
  venueId: string,
  status: "check" | "all",
  offset: number,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster-files/review", {
      params: {
        path: { venue_id: venueId },
        query: { status, limit: 25, offset },
      },
    }),
    z.object({
      items: z.array(rosterFileSummarySchema),
      total: z.number(),
      offset: z.number(),
      limit: z.number(),
    }),
    next,
  );
}

export function fetchRosterFile(
  accessToken: string,
  venueId: string,
  documentId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/roster-files/{document_id}",
      { params: { path: { venue_id: venueId, document_id: documentId } } },
    ),
    rosterFileDetailSchema,
    next,
  );
}
