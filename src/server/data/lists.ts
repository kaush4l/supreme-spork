import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

/** A number the backend may send as a JSON number or as text (a decimal). */
const num = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

export const answerSchema = z.object({
  ticked: z.boolean().nullable().optional(),
  number: num,
  note: z.string().nullable().optional(),
  photo_document_id: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  out_of_range: z.boolean().optional(),
  answered_at: z.string().nullable().optional(),
  answered_by: z.string().nullable().optional(),
  answered_by_name: z.string().nullable().optional(),
});
export type Answer = z.infer<typeof answerSchema>;

export const itemSchema = z.object({
  item_key: z.string(),
  sort_order: z.number().optional(),
  label: z.string(),
  kind: z.enum(["tick", "number", "note", "photo"]),
  required: z.boolean(),
  instruction: z.string().nullable().optional(),
  min_value: num,
  max_value: num,
  origin: z.string().nullable().optional(),
  not_applicable: z.boolean(),
  not_applicable_reason: z.string().nullable().optional(),
  answer: answerSchema.nullable().optional(),
});
export type ListItem = z.infer<typeof itemSchema>;

export const progressSchema = z.object({
  items: z.number(),
  answered: z.number(),
  required: z.number(),
  required_answered: z.number(),
  not_applicable: z.number(),
  out_of_range: z.number(),
});
export type Progress = z.infer<typeof progressSchema>;

export const listDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  staff_ref: z.string().nullable().optional(),
  trading_day: z.string(),
  due_at: z.string(),
  status: z.enum(["open", "overdue", "missed", "done"]),
  completed_at: z.string().nullable().optional(),
  progress: progressSchema,
  items: z.array(itemSchema),
});
export type ListDetail = z.infer<typeof listDetailSchema>;

/** One of the caller's own lists, with its items, answers and progress. */
export function myListDetail(
  accessToken: string,
  venueId: string,
  listId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/workflows/me/lists/{list_id}",
      { params: { path: { venue_id: venueId, list_id: listId } } },
    ),
    listDetailSchema,
    next,
  );
}
