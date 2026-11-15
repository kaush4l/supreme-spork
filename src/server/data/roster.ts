import "server-only";
import { z } from "zod";
import { addDays } from "@/app/(app)/venues/[venueId]/roster/week";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** A roster shift as the builder sends it. The cost per hour is left out on purpose: the roster screen never shows pay. */
export const rosterShiftSchema = z.object({
  external_id: z.string(),
  status: z.string(),
  staff_ref: z.string().nullable().optional(),
  staff_name: z.string().nullable().optional(),
  position: z.string().nullable(),
  start: z.string(),
  end: z.string(),
  break_minutes: z.number(),
  hours: z.number().nullable().optional(),
});
export type RosterShift = z.infer<typeof rosterShiftSchema>;

const briefSchema = z.object({
  external_id: z.string(),
  staff_name: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  start: z.string(),
  end: z.string(),
});

export const warningSchema = z.object({
  kind: z.string(),
  severity: z.string(),
  staff_ref: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  message: z.string(),
  external_ids: z.array(z.string()),
});
export type RosterWarning = z.infer<typeof warningSchema>;

/** `GET /roster?week=`: the draft week. `state` is `not_published`, `changed_since_publish` or `published`. */
export const gridSchema = z.object({
  week_start: z.string(),
  state: z.string(),
  version: z.number().nullable(),
  published_at: z.string().nullable(),
  unpublished_changes: z
    .object({
      added: z.array(briefSchema),
      removed: z.array(briefSchema),
      changed: z.array(briefSchema),
    })
    .nullable()
    .optional(),
  shifts: z.array(rosterShiftSchema),
  checks: z
    .object({ warnings: z.array(warningSchema) })
    .optional()
    .default({ warnings: [] }),
  leave: z
    .array(
      z.object({
        staff_name: z.string().nullable().optional(),
        start_date: z.string(),
        end_date: z.string(),
      }),
    )
    .optional()
    .default([]),
});
export type RosterGrid = z.infer<typeof gridSchema>;

/** `GET /roster/published?week=`: the version staff see, with who has and has not opened it. */
export const publishedSchema = z.object({
  week_start: z.string(),
  version: z.number(),
  published_at: z.string(),
  seen: z.array(
    z.object({
      staff_ref: z.string(),
      name: z.string(),
      seen_at: z.string(),
    }),
  ),
  not_seen: z.array(
    z.object({
      staff_ref: z.string(),
      name: z.string(),
      has_login: z.boolean(),
    }),
  ),
});
export type RosterPublished = z.infer<typeof publishedSchema>;

const positionsSchema = z.array(
  z.object({ id: z.string(), name: z.string(), active: z.boolean() }),
);

const staffPageSchema = z
  .object({
    items: z.array(
      z.object({
        id: z.string(),
        staff_ref: z.string(),
        name: z.string(),
        active: z.boolean(),
        position_names: z.array(z.string()).optional().default([]),
      }),
    ),
  })
  .transform((page) => page.items);

const q = (venueId: string) => ({ path: { venue_id: venueId } });

export function rosterGrid(
  accessToken: string,
  venueId: string,
  week: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster", {
      params: { path: q(venueId).path, query: { week } },
    }),
    gridSchema,
    next,
  );
}

/** The published version of a week, or null when the week has not been published (the backend answers 404). */
export async function rosterPublished(
  accessToken: string,
  venueId: string,
  week: string,
  next: string,
): Promise<RosterPublished | null> {
  const answer = await backend(accessToken).GET(
    "/v1/venues/{venue_id}/roster/published",
    { params: { path: q(venueId).path, query: { week } } },
  );
  if (answer.response.status === 404) return null;
  return read(Promise.resolve(answer), publishedSchema, next);
}

export function rosterPositions(
  accessToken: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/positions", {
      params: q(venueId),
    }),
    positionsSchema,
    next,
  );
}

/**
 * Active people who can be put on a shift. The staff list needs the `staff.manage` right, which not everyone who builds
 * the roster holds: then the list is empty and shifts can only be made open.
 */
export async function rosterPeople(accessToken: string, venueId: string) {
  const answer = await backend(accessToken).GET("/v1/venues/{venue_id}/staff", {
    params: { path: q(venueId).path, query: { active: true, limit: 200 } },
  });
  if (answer.response.status === 403) return [];
  return read(Promise.resolve(answer), staffPageSchema, "/");
}

/**
 * The Monday of the week to open when the address names none. The backend has no "this week" route; the rostered-hours
 * report answers with the last finished week when asked for no week, and the week after it is the current one.
 */
export async function currentWeek(accessToken: string, venueId: string) {
  const last = await read(
    backend(accessToken).GET("/v1/venues/{venue_id}/roster-hours", {
      params: { path: q(venueId).path, query: {} },
    }),
    z.object({ week_start: z.string() }),
    `/venues/${venueId}/roster`,
  );
  return addDays(last.week_start, 7);
}
