"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const kinds = [
  "ato",
  "super",
  "rent",
  "loan",
  "insurance",
  "utilities",
  "supplier",
  "other",
] as const;
const cadences = ["weekly", "fortnightly", "monthly", "quarterly"] as const;

/** Add a bill the person knows about. A same kind and payee bill is the API's 409 `bill_exists`, shown as it is sent. */
export const addBill = action(
  strictInput({
    venueId: z.uuid(),
    key: z.string(),
    label: z.string().trim().min(1).max(200),
    kind: z.enum(kinds),
    counterparty: z.string().trim().max(200).optional(),
    amountCents: z.number().int().positive(),
    cadence: z.enum(cadences),
    nextDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  async (input, principal) => {
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/venues/{venue_id}/bills",
      {
        params: { path: { venue_id: input.venueId } },
        body: {
          label: input.label,
          kind: input.kind,
          counterparty: input.counterparty || null,
          amount_cents: input.amountCents,
          cadence: input.cadence,
          next_due: input.nextDue,
        },
        headers: idempotencyHeader(input.key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath(`/venues/${input.venueId}/bills`);
    const made = data as { bill_id?: string; next_due?: string };
    return { billId: made.bill_id ?? null, nextDue: made.next_due ?? null };
  },
);
