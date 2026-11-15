import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

export const questionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  label: z.string(),
  help: z.string(),
  prompt: z.string(),
  created_at: z.string(),
  answer: z.record(z.string(), z.unknown()).nullish(),
  date: z.string().nullish(),
  amount_cents: z.number().nullish(),
  amount_text: z.string().nullish(),
  payee_text: z.string().nullish(),
});
export type Question = z.infer<typeof questionSchema>;

export const questionsSchema = z.object({
  items: z.array(questionSchema),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
});

export const QUESTION_STATUSES = [
  "open",
  "answered",
  "dismissed",
  "all",
] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export function fetchQuestions(
  accessToken: string,
  venueId: string,
  status: QuestionStatus,
  offset: number,
  next: string,
  limit = 25,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/bank-questions", {
      params: { path: { venue_id: venueId }, query: { status, limit, offset } },
    }),
    questionsSchema,
    next,
  );
}

const similarSchema = z.object({
  date: z.string(),
  amount_cents: z.number(),
  amount_text: z.string(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  category_label: z.string().nullish(),
});

export const ruleOfferSchema = z.object({
  pattern: z.string(),
  category: z.string(),
  category_label: z.string(),
  times_answered: z.number(),
  rows_that_would_change: z.number(),
  text: z.string(),
});

export const questionDetailSchema = questionSchema.extend({
  summary: z.string().nullish(),
  rule_offer: ruleOfferSchema.nullish(),
  evidence: z
    .object({
      date: z.string().nullish(),
      amount_cents: z.number().nullish(),
      amount_text: z.string().nullish(),
      direction: z.string().nullish(),
      payee_text: z.string().nullish(),
      similar_rows: z.array(similarSchema).optional(),
      similar_total: z.number().optional(),
      usual_category: z
        .object({ name: z.string(), label: z.string(), times: z.number() })
        .nullish(),
      matching_docket: z.object({ text: z.string() }).passthrough().nullish(),
      docket: z
        .object({
          document_id: z.string(),
          supplier: z.string().nullish(),
          delivered_on: z.string().nullish(),
          total_cents: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});
export type QuestionDetail = z.infer<typeof questionDetailSchema>;

export function fetchQuestion(
  accessToken: string,
  venueId: string,
  questionId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET(
      "/v1/venues/{venue_id}/bank-questions/{question_id}",
      {
        params: { path: { venue_id: venueId, question_id: questionId } },
      },
    ),
    questionDetailSchema,
    next,
  );
}

export const categorySchema = z.object({
  name: z.string(),
  label: z.string(),
  cost_centre: z.string().nullish(),
  personal: z.boolean(),
  active: z.boolean(),
  protected: z.boolean(),
  in_use: z.number(),
  source: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

export function fetchCategories(
  accessToken: string,
  venueId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/categories", {
      params: { path: { venue_id: venueId } },
    }),
    z.object({ items: z.array(categorySchema) }).transform((p) => p.items),
    next,
  );
}

export const fileSummarySchema = z.object({
  document_id: z.string(),
  filename: z.string().nullish(),
  received_at: z.string(),
  status: z.string(),
  label: z.string(),
  help: z.string(),
  rows_read: z.number(),
  reasons: z.array(z.string()),
});
export type BankFile = z.infer<typeof fileSummarySchema>;

export function fetchFileQueue(
  accessToken: string,
  venueId: string,
  status: "check" | "all",
  offset: number,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/bank-files/review", {
      params: {
        path: { venue_id: venueId },
        query: { status, limit: 25, offset },
      },
    }),
    z.object({
      items: z.array(fileSummarySchema),
      total: z.number(),
      offset: z.number(),
      limit: z.number(),
    }),
    next,
  );
}

export const fileDetailSchema = fileSummarySchema.extend({
  period_start: z.string().nullish(),
  period_end: z.string().nullish(),
  rows: z.array(
    z.object({
      line: z.number(),
      date: z.string(),
      description: z.string().nullish(),
      amount_cents: z.number(),
      balance_cents: z.number().nullish(),
    }),
  ),
  rows_total: z.number(),
  rows_shown: z.number(),
  money_in_cents: z.number(),
  money_out_cents: z.number(),
  questions_open: z.number(),
  file_url: z.string().nullish(),
});
export type BankFileDetail = z.infer<typeof fileDetailSchema>;

export function fetchFile(
  accessToken: string,
  venueId: string,
  documentId: string,
  next: string,
) {
  return read(
    backend(accessToken).GET("/v1/venues/{venue_id}/bank-files/{document_id}", {
      params: { path: { venue_id: venueId, document_id: documentId } },
    }),
    fileDetailSchema,
    next,
  );
}
