import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { backend } from "../api/backend";
import { fetchMe } from "../api/me";
import { safeNextPath } from "./next-path";
import { getPrincipal } from "./principal";
import { supabaseServer } from "./supabase";

/** The authenticator-app factors of the signed-in person. */
export async function totpFactors(supabase: SupabaseClient) {
  const { data } = await supabase.auth.mfa.listFactors();
  const all = data?.all ?? [];
  return {
    verified: all.filter(
      (factor) => factor.factor_type === "totp" && factor.status === "verified",
    ),
    unverified: all.filter(
      (factor) =>
        factor.factor_type === "totp" && factor.status === "unverified",
    ),
  };
}

const withNext = (path: string, next: string) =>
  `${path}?next=${encodeURIComponent(next)}`;

/**
 * Where a person goes straight after the password step: to confirm a code if they have an authenticator app, to set one
 * up if the backend says their role needs a second factor and they have none, otherwise on to where they were going.
 * Never to a page that needs the second factor while they lack it: the backend would answer `mfa_required` anyway.
 */
export async function routeAfterSignIn(
  rawNext: string | null | undefined,
): Promise<string> {
  const next = safeNextPath(rawNext);
  const supabase = await supabaseServer();
  const { data: level } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.nextLevel === "aal2" && level.currentLevel !== "aal2")
    return withNext("/mfa/challenge", next);
  const principal = await getPrincipal();
  if (principal) {
    const me = await fetchMe(backend(principal.accessToken)).catch(() => null);
    if (me?.mfa.required && me.mfa.level !== "aal2")
      return withNext("/mfa/enroll", next);
  }
  return next;
}
