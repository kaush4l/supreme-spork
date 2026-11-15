import { z } from "zod";

/** What the browser sends to answer one item. `key` is the Idempotency-Key for this save. */
export const answerInput = {
  venueId: z.uuid(),
  listId: z.uuid(),
  itemKey: z.string().min(1).max(64),
  key: z.string(),
  ticked: z.boolean().optional(),
  number: z.number().finite().optional(),
  note: z.string().max(1000).optional(),
  photoDocumentId: z.string().max(64).optional(),
};

export type AnswerSaved = { outOfRange: boolean; photoUrl: string | null };

export function answerBody(input: {
  ticked?: boolean;
  number?: number;
  note?: string;
  photoDocumentId?: string;
}) {
  return {
    ticked: input.ticked,
    number: input.number,
    note: input.note,
    photo_document_id: input.photoDocumentId,
  };
}

export function savedFrom(data: unknown): AnswerSaved {
  const a = (data ?? {}) as { out_of_range?: unknown; photo_url?: unknown };
  return {
    outOfRange: a.out_of_range === true,
    photoUrl: typeof a.photo_url === "string" ? a.photo_url : null,
  };
}
