import "server-only";
import { redirect } from "next/navigation";
import { createAction } from "./action-core";
import { requirePrincipal } from "./auth/principal";

export { type ActionResult, strictInput } from "./action-core";

/**
 * Wrap every Server Action with this: `export const addNote = action(strictInput({...}), async (input, principal) => ...)`.
 * The page that shows the form does not protect the action; the action is reachable by a direct POST, so it checks
 * for itself.
 */
export const action = createAction({
  requirePrincipal,
  signInRequired: () => redirect("/sign-in"),
  log: (message, error) =>
    console.error(
      message,
      error instanceof Error ? error.message : "unknown error",
    ),
});
