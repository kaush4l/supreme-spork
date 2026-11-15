import { ApiFailure } from "./api/errors";
import { isSameSiteWrite } from "./origin";

/** The largest body a Route Handler reads (a photo upload): the backend's own cap of 15 MB, plus form framing. */
export const MAX_BODY_BYTES = 16 * 1024 * 1024;

const json = (
  status: number,
  code: string,
  message: string,
  field: string | null = null,
) =>
  Response.json(
    { error: { code, message, field } },
    { status, headers: { "Cache-Control": "no-store" } },
  );

type Deps<P> = {
  siteUrl: () => string;
  getPrincipal: () => Promise<P | null>;
  log: (message: string, error: unknown) => void;
};

/**
 * The shape of every Route Handler (used only where a Server Action cannot be: file upload and download). A write
 * must come from this site, the caller must be signed in, and the body is capped before it is read. Failures use the
 * same `{error: {code, message, field}}` shape as the backend.
 */
export function createHandler<P>(deps: Deps<P>) {
  return function handler(
    run: (request: Request, principal: P) => Promise<Response>,
  ) {
    return async (request: Request): Promise<Response> => {
      if (!isSameSiteWrite(request, deps.siteUrl())) {
        return json(
          403,
          "cross_site_request",
          "That request did not come from this site.",
        );
      }
      const principal = await deps.getPrincipal();
      if (!principal)
        return json(401, "sign_in_required", "Please sign in again.");
      const declared = Number(request.headers.get("content-length") ?? 0);
      if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) {
        return json(413, "file_too_large", "That file is too large.");
      }
      try {
        return await run(request, principal);
      } catch (error) {
        if (error instanceof ApiFailure)
          return json(error.status, error.code, error.message, error.field);
        deps.log("route handler failed", error);
        return json(
          500,
          "server_error",
          "Something went wrong on our side. Please try again.",
        );
      }
    };
  };
}
