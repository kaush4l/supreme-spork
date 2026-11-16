"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { action, strictInput } from "@/server/action";
import { backend } from "@/server/api/backend";
import { toApiFailure } from "@/server/api/errors";

const stored = z.object({ id: z.string().min(1) });

/**
 * Save this browser's push subscription (what `PushSubscription.toJSON()` gives) for the signed-in person. The backend
 * checks the address and keys; the UI only passes them on. Posting the same browser twice is harmless.
 */
export const savePushSubscription = action(
  strictInput({
    endpoint: z.string().min(1).max(2048),
    keys: strictInput({
      p256dh: z.string().min(1).max(256),
      auth: z.string().min(1).max(256),
    }),
  }),
  async (input, principal) => {
    // The browser's own name for itself, so the backend's device row says which phone this is.
    const userAgent = (await headers()).get("user-agent");
    const { data, error, response } = await backend(principal.accessToken).POST(
      "/v1/me/push/subscriptions",
      {
        body: { endpoint: input.endpoint, keys: input.keys },
        params: { header: userAgent ? { "user-agent": userAgent } : {} },
      },
    );
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    const parsed = stored.safeParse(data);
    if (!parsed.success)
      throw toApiFailure(502, { error: { message: "Unexpected answer." } });
    return { id: parsed.data.id };
  },
);

/** Stop alerts on this phone. Only the person's own device can be ended; repeating it is harmless. */
export const removePushSubscription = action(
  strictInput({ id: z.string().min(1).max(100) }),
  async (input, principal) => {
    const { error, response } = await backend(principal.accessToken).DELETE(
      "/v1/me/push/subscriptions/{subscription_id}",
      { params: { path: { subscription_id: input.id } } },
    );
    // Already gone is the same as done.
    if (response.status === 404) return { removed: true };
    if (error !== undefined || !response.ok)
      throw toApiFailure(response.status, error);
    return { removed: true };
  },
);
