import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { type ListDetail, listDetailSchema, progressSchema } from "./lists";

const num = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

const status = z.enum(["open", "overdue", "missed", "done"]);

const readingSchema = z.object({
  item_key: z.string(),
  label: z.string(),
  value: num,
  min_value: num,
  max_value: num,
});

const boardListSchema = z.object({
  id: z.string(),
  name: z.string(),
  trading_day: z.string(),
  due_at: z.string(),
  status,
  completed_at: z.string().nullable().optional(),
  progress: progressSchema,
  out_of_range: z.array(readingSchema),
  photos: z.array(
    z.object({
      item_key: z.string(),
      label: z.string(),
      document_id: z.string(),
    }),
  ),
});
export type BoardList = z.infer<typeof boardListSchema>;

const shiftGroupSchema = z.object({
  shift_external_id: z.string(),
  staff_ref: z.string().nullable().optional(),
  staff: z.string(),
  position: z.string().nullable().optional(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  lists: z.array(boardListSchema),
});
export type ShiftGroup = z.infer<typeof shiftGroupSchema>;

export const boardSchema = z.object({
  day: z.string(),
  generated_at: z.string(),
  counts: z.object({
    lists: z.number(),
    done: z.number(),
    open: z.number(),
    overdue: z.number(),
    missed: z.number(),
    out_of_range: z.number(),
    photos: z.number(),
  }),
  shifts: z.array(shiftGroupSchema),
  overdue: z.array(
    z.object({
      list_id: z.string(),
      list: z.string(),
      staff: z.string(),
      due_at: z.string(),
      status,
      minutes_late: z.number(),
    }),
  ),
  out_of_range: z.array(
    readingSchema.extend({
      list_id: z.string(),
      list: z.string(),
      staff: z.string(),
      answered_at: z.string().nullable().optional(),
    }),
  ),
});
export type Board = z.infer<typeof boardSchema>;

/** The Today board (managers only). Without `day` the backend uses the venue's current trading day. */
export function todayBoard(
  accessToken: string,
  venueId: string,
  day: string | undefined,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/workflows/today", {
      params: {
        path: { venue_id: venueId },
        ...(day ? { query: { day } } : {}),
      },
    }),
    boardSchema,
    next,
  );
}

/** Any list at the venue, for a manager. */
export function managerListDetail(
  accessToken: string,
  venueId: string,
  listId: string,
  next: string,
): Promise<ListDetail> {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/workflows/lists/{list_id}",
      {
        params: { path: { venue_id: venueId, list_id: listId } },
      },
    ),
    listDetailSchema,
    next,
  );
}
