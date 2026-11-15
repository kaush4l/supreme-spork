import "server-only";
import { notFound, redirect } from "next/navigation";
import type { z } from "zod";
import { ApiFailure, toApiFailure } from "./errors";

type Answer = { data?: unknown; error?: unknown; response: Response };

/**
 * Read one backend answer for a page: sign-in and second-factor redirects, 403/404 as "not found", anything else as an
 * error the nearest `error.tsx` shows, and the body checked against `schema` (the backend's untyped objects are never
 * trusted as they come). `next` is where to return after a second factor.
 */
export async function read<S extends z.ZodType>(
  answer: Promise<Answer>,
  schema: S,
  next: string,
): Promise<z.infer<S>> {
  const { data, error, response } = await answer;
  if (!response.ok) {
    const failure = toApiFailure(response.status, error);
    if (failure.needsSignIn) redirect("/sign-in");
    if (failure.code === "mfa_required")
      redirect(`/mfa/challenge?next=${encodeURIComponent(next)}`);
    if (response.status === 403 || response.status === 404) notFound();
    throw failure;
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new ApiFailure(
      502,
      "bad_answer",
      "The server sent an answer we did not expect.",
    );
  return parsed.data;
}
