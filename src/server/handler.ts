import "server-only";
import { getPrincipal } from "./auth/principal";
import { env } from "./env";
import { createHandler } from "./handler-core";

/**
 * Wrap every Route Handler with this: `export const POST = handler(async (request, principal) => ...)`.
 * Prefer a Server Action (`action.ts`); use a handler only for uploads and downloads.
 */
export const handler = createHandler({
  siteUrl: () => env().SITE_URL,
  getPrincipal,
  log: (message, error) =>
    console.error(
      message,
      error instanceof Error ? error.message : "unknown error",
    ),
});
