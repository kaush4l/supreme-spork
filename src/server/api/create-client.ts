import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * The only way this app calls the backend. Requests can go nowhere but `baseUrl` (a request to another origin is
 * refused before it is sent), redirects are never followed, and the caller's own cookies and headers are never
 * forwarded: the one credential sent is the access token passed in here.
 */
export function assertSameOrigin(baseUrl: string, requestUrl: string): void {
  if (new URL(requestUrl).origin !== new URL(baseUrl).origin) {
    throw new Error("Refusing to call a host other than the backend.");
  }
}

export function createBackendClient(options: {
  baseUrl: string;
  accessToken?: string;
  fetch?: typeof fetch;
}) {
  const { baseUrl, accessToken } = options;
  const send = options.fetch ?? fetch;
  return createClient<paths>({
    baseUrl,
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
    fetch: (request: Request) => {
      assertSameOrigin(baseUrl, request.url);
      return send(
        new Request(request, { redirect: "error", credentials: "omit" }),
      );
    },
  });
}
