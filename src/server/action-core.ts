import { z } from "zod";
import { ApiFailure } from "./api/errors";

/**
 * The shape of every Server Action: sign-in checked first, then the input parsed with a schema that refuses unknown
 * fields, then the backend call, with every failure turned into one serializable result. The input schema must be
 * built with `strictInput` so a field the form did not define is an error, not silently ignored (mass assignment).
 */
export const strictInput = z.strictObject;

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };

type Deps<P> = {
  requirePrincipal: () => Promise<P>;
  /** Sends the person to the sign-in page (throws, as Next's `redirect` does). */
  signInRequired: () => never;
  log: (message: string, error: unknown) => void;
};

export function createAction<P>(deps: Deps<P>) {
  return function action<S extends z.ZodType, R>(
    schema: S,
    run: (input: z.infer<S>, principal: P) => Promise<R>,
  ) {
    return async (raw: unknown): Promise<ActionResult<R>> => {
      const principal = await deps.requirePrincipal();
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          // Name the field and the rule, never the submitted value.
          if (issue.code === "unrecognized_keys") {
            for (const key of issue.keys)
              fields[[...issue.path, key].join(".")] = "Not accepted.";
          } else {
            fields[issue.path.join(".") || "form"] = "Check this field.";
          }
        }
        return {
          ok: false,
          error: {
            code: "validation_error",
            message: "Check the details and try again.",
            fields,
          },
        };
      }
      try {
        return { ok: true, data: await run(parsed.data, principal) };
      } catch (error) {
        if (error instanceof ApiFailure) {
          if (error.needsSignIn) deps.signInRequired();
          return {
            ok: false,
            error: {
              code: error.code,
              message: error.message,
              ...(error.field
                ? { fields: { [error.field]: error.message } }
                : {}),
            },
          };
        }
        if (isRedirectOrNotFound(error)) throw error;
        deps.log("action failed", error);
        return {
          ok: false,
          error: {
            code: "server_error",
            message: "Something went wrong on our side. Please try again.",
          },
        };
      }
    };
  };
}

/** Next.js implements `redirect()` and `notFound()` by throwing; they must reach the framework. */
function isRedirectOrNotFound(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}
