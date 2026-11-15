"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";
import { ruleOfferSchema } from "@/server/data/bank";
import { pickNext } from "./next";

const ids = { venueId: z.uuid(), questionId: z.uuid(), key: z.string() };

/** The first open question after this one, so a phone can go straight on. Never fails the answer that already worked. */
async function nextOpen(
  token: string,
  venueId: string,
  closed: string,
): Promise<string | null> {
  const { data, response } = await backend(token).GET(
    "/v1/venues/{venue_id}/bank-questions",
    {
      params: {
        path: { venue_id: venueId },
        query: { status: "open", limit: 3 },
      },
    },
  );
  if (!response.ok) return null;
  const items = (data as { items?: { id: string }[] } | undefined)?.items ?? [];
  return pickNext(
    items.map((i) => i.id),
    closed,
  );
}

/**
 * Answer one question: a category for a payment, or a note for a docket with no payment. The answer may carry a rule
 * offer; it is only passed on, never accepted here.
 */
export const answerQuestion = action(
  strictInput({
    ...ids,
    category: z.string().min(1).max(100).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bank-questions/{question_id}/answer",
      {
        params: {
          path: { venue_id: input.venueId, question_id: input.questionId },
        },
        body: {
          category: input.category ?? null,
          note: input.note || null,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bank`);
    const offer = ruleOfferSchema.safeParse(
      (data as { rule_offer?: unknown } | undefined)?.rule_offer,
    );
    return {
      ruleOffer: offer.success ? offer.data : null,
      nextId: await nextOpen(
        principal.accessToken,
        input.venueId,
        input.questionId,
      ),
    };
  },
);

export const dismissQuestion = action(
  strictInput({ ...ids, note: z.string().trim().max(500).optional() }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bank-questions/{question_id}/dismiss",
      {
        params: {
          path: { venue_id: input.venueId, question_id: input.questionId },
        },
        body: { note: input.note || null },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bank`);
    return {
      nextId: await nextOpen(
        principal.accessToken,
        input.venueId,
        input.questionId,
      ),
    };
  },
);

/** Accept the rule the API offered after an answer. */
export const makeRule = action(strictInput(ids), async (input, principal) => {
  const { data, error, response } = await backend(principal.accessToken).POST(
    "/v1/venues/{venue_id}/bank-questions/{question_id}/rule",
    {
      params: {
        path: { venue_id: input.venueId, question_id: input.questionId },
      },
      headers: idempotencyHeader(input.key),
    },
  );
  if (error !== undefined || !response.ok)
    throw toApiFailure(response.status, error);
  revalidatePath(`/venues/${input.venueId}/bank`);
  const answer = data as { recategorised?: number; already_made?: boolean };
  return {
    recategorised: answer.recategorised ?? 0,
    alreadyMade: answer.already_made === true,
  };
});
