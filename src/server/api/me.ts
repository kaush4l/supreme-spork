import { z } from "zod";
import type { createBackendClient } from "./create-client";
import { toApiFailure } from "./errors";

/** `GET /v1/me`, parsed: the backend returns an untyped object, so its shape is checked here before the UI trusts it. */
export const meSchema = z.object({
  user: z
    .object({
      id: z.string(),
      email: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
    })
    .nullable(),
  memberships: z.array(
    z.object({
      org_id: z.string(),
      venue_id: z.string().nullable(),
      role: z.enum(["owner", "partner", "manager", "bookkeeper", "staff"]),
      approval_limit_cents: z.number().nullable().optional(),
    }),
  ),
  venues: z.array(
    z.object({
      id: z.string(),
      org_id: z.string(),
      name: z.string(),
      timezone: z.string().nullable().optional(),
    }),
  ),
  pending_invites: z.array(
    z.object({
      id: z.string(),
      venue_id: z.string().nullable(),
      venue_name: z.string().nullable(),
      role: z.string(),
    }),
  ),
  mfa: z.object({ required: z.boolean(), level: z.enum(["aal1", "aal2"]) }),
});

export type Me = z.infer<typeof meSchema>;

export async function fetchMe(
  client: ReturnType<typeof createBackendClient>,
): Promise<Me> {
  const { data, error, response } = await client.GET("/v1/me");
  if (error !== undefined || !response.ok)
    throw toApiFailure(response.status, error);
  const parsed = meSchema.safeParse(data);
  if (!parsed.success) throw toApiFailure(502, null);
  return parsed.data;
}
