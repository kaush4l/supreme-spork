import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const staffSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  position_names: z.array(z.string()),
  hourly_cost_cents: z.number().nullable(),
  active: z.boolean(),
  has_login: z.boolean(),
  employee_no: z.string().nullable().optional(),
  started_on: z.string().nullable().optional(),
  ended_on: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  /** The person's sign-in id (users.id). The backend does not send it today; the reset button needs it. */
  user_id: z.string().nullable().optional(),
});
export type StaffRow = z.infer<typeof staffSchema>;

export const positionSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  default_rate_cents: z.number().optional(),
  required_certificates: z.array(z.string()).optional(),
});
export type PositionRow = z.infer<typeof positionSchema>;

export const inviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  status: z.string(),
  created_at: z.string().optional(),
});
export type InviteRow = z.infer<typeof inviteSchema>;

const path = (venueId: string) => ({ params: { path: { venue_id: venueId } } });

/** Everyone on the staff list, ended people too (the page splits them by `active`). */
export function listStaff(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/staff", {
      params: { path: { venue_id: venueId }, query: { limit: 200 } },
    }),
    z.object({ items: z.array(staffSchema) }).transform((p) => p.items),
    next,
  );
}

export function listPositions(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/positions", {
      params: {
        path: { venue_id: venueId },
        query: { include_inactive: true },
      },
    }),
    z.array(positionSchema),
    next,
  );
}

export function listInvites(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/invites", path(venueId)),
    z.array(inviteSchema),
    next,
  );
}
