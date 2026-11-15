"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";
import { idempotencyHeader } from "@/server/api/idempotency";

const text = (max: number) => z.string().max(max).nullable().optional();

/** Only the fields that changed are sent; a field sent as null is cleared. There is no pay field, by design. */
export const saveProfile = action(
  strictInput({
    key: z.string(),
    displayName: text(120),
    phone: text(40),
    headline: text(120),
    about: text(2000),
    skills: z.array(z.string().max(40)).max(30).optional(),
  }),
  async ({ key, displayName, phone, headline, about, skills }, principal) => {
    const body = {
      ...(displayName !== undefined ? { display_name: displayName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(headline !== undefined ? { headline } : {}),
      ...(about !== undefined ? { about } : {}),
      ...(skills !== undefined ? { skills } : {}),
    };
    const { error, response } = await backend(principal.accessToken).POST(
      "/v1/me/profile",
      { body, headers: idempotencyHeader(key) },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    revalidatePath("/account/profile");
    return { saved: true };
  },
);
