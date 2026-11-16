import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { backend } from "../api/backend";
import { ApiFailure, toApiFailure } from "../api/errors";

/**
 * The key a browser subscribes to push with, or null when the server has no push keys yet (404 `push_not_set_up`).
 * Any other failure is a real error. The key is public.
 */
export async function pushPublicKey(token: string): Promise<string | null> {
  const { data, error, response } = await backend(token).GET(
    "/v1/me/push/public-key",
  );
  if (response.status === 404) {
    const failure = toApiFailure(404, error);
    if (failure.code === "push_not_set_up") return null;
  }
  if (!response.ok) {
    const failure = toApiFailure(response.status, error);
    if (failure.needsSignIn) redirect("/sign-in");
    throw failure;
  }
  const parsed = z.object({ public_key: z.string().min(1) }).safeParse(data);
  if (!parsed.success)
    throw new ApiFailure(
      502,
      "bad_answer",
      "The server sent an answer we did not expect.",
    );
  return parsed.data.public_key;
}
