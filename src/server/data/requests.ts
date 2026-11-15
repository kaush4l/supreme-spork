import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

const base = (venueId: string) => ({ params: { path: { venue_id: venueId } } });

export const requestSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  description: z.string(),
  note: z.string().nullable().optional(),
  details: z
    .object({
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      reason: z.string().nullable().optional(),
      to_staff_name: z.string().optional(),
    })
    .loose(),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
});
export type MyRequest = z.infer<typeof requestSchema>;

export const blackoutSchema = z.object({
  id: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  reason: z.string(),
});

export const colleagueSchema = z.object({
  id: z.string(),
  name: z.string(),
  position_names: z.array(z.string()).optional(),
});

export function myRequests(accessToken: string, venueId: string, next: string) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/me/requests",
      base(venueId),
    ),
    z.array(requestSchema),
    next,
  );
}

export function myBlackouts(
  accessToken: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/me/blackouts",
      base(venueId),
    ),
    z.array(blackoutSchema),
    next,
  );
}

export function myColleagues(
  accessToken: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/me/colleagues",
      base(venueId),
    ),
    z.array(colleagueSchema),
    next,
  );
}
