import "server-only";
import { env } from "../env";
import { createBackendClient } from "./create-client";

/** The backend client for one signed-in person's access token. Server only. */
export function backend(accessToken: string) {
  return createBackendClient({ baseUrl: env().BACKEND_URL, accessToken });
}
