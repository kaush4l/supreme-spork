import "server-only";
import { headers } from "next/headers";
import { env } from "./env";
import { isSameSiteWrite } from "./origin";
import { createPublicAction } from "./public-action-core";

export type { FormState } from "./public-action-core";

/** Wrap a Server Action for a signed-out person with this. Signed-in actions use `action` (src/server/action.ts). */
export const publicAction = createPublicAction({
  sameSite: async () =>
    isSameSiteWrite(
      { method: "POST", headers: await headers() },
      env().SITE_URL,
    ),
  log: (message, error) =>
    console.error(
      message,
      error instanceof Error ? error.message : "unknown error",
    ),
});
