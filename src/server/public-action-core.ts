import type { z } from "zod";
import { ApiFailure } from "./api/errors";

/**
 * The shape of a Server Action for a signed-out person (sign-in, sign-up, reset): the write must come from this site,
 * the form's fields are picked by name from the schema (Next adds its own hidden fields, which are ignored) and parsed
 * with it, and every outcome is one serializable state a form can show. Nothing here reveals whether an address has an
 * account; the messages come from `auth/messages.ts`. Actions for a signed-in person use `action` instead.
 */
export type FormState = {
  ok?: boolean;
  message?: string;
  fields?: Record<string, string>;
  data?: Record<string, string>;
} | null;

type Deps = {
  sameSite: () => Promise<boolean>;
  log: (message: string, error: unknown) => void;
};

function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}

export function createPublicAction(deps: Deps) {
  return function publicAction<S extends z.ZodObject>(
    schema: S,
    run: (input: z.infer<S>) => Promise<FormState>,
  ) {
    return async (
      _previous: FormState,
      formData: FormData,
    ): Promise<FormState> => {
      if (!(await deps.sameSite())) {
        return {
          message:
            "That request did not come from this site. Reload the page and try again.",
        };
      }
      const raw: Record<string, string> = {};
      for (const key of Object.keys(schema.shape)) {
        const value = formData.get(key);
        if (typeof value === "string" && value !== "") raw[key] = value;
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues)
          fields[String(issue.path[0] ?? "form")] = "Check this field.";
        return { message: "Check the details and try again.", fields };
      }
      try {
        return await run(parsed.data);
      } catch (error) {
        if (isFrameworkSignal(error)) throw error;
        if (error instanceof ApiFailure) return { message: error.message };
        deps.log("public action failed", error);
        return {
          message: "Something went wrong on our side. Please try again.",
        };
      }
    };
  };
}
