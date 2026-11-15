"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const kind = z.enum(["rsa", "food_safety", "first_aid", "other"]);

/** Add a certificate, or correct the one of that kind (one current certificate per kind). */
export const saveCertificate = action(
  strictInput({
    key: z.string(),
    kind,
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    number: z.string().max(60).nullable(),
  }),
  async ({ key, kind, expiresOn, number }, principal) => {
    const { error, response } = await backend(principal.accessToken).PUT(
      "/v1/me/certificates/{kind}",
      {
        params: { path: { kind } },
        body: { expires_on: expiresOn, number },
        headers: idempotencyHeader(key),
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/account/certificates");
    return { saved: true };
  },
);

export const removeCertificate = action(
  strictInput({ kind }),
  async ({ kind }, principal) => {
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/me/certificates/{kind}/remove",
      { params: { path: { kind } } },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/account/certificates");
    return { removed: true };
  },
);
