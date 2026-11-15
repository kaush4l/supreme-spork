import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "./next-path";
import { supabaseServer } from "./supabase";

export type Principal = {
  /** The login's id (the token's `sub`). */
  userId: string;
  email: string | undefined;
  /** `aal2` once the person has passed a second factor. */
  assuranceLevel: "aal1" | "aal2";
  /** Sent to the backend only; never returned to the browser. */
  accessToken: string;
};

/**
 * Who is calling, or null. The token's signature and expiry are verified on every call (`getClaims`); the session
 * is never trusted as read from the cookie. Every page, Server Action and Route Handler calls this itself:
 * `proxy.ts` only refreshes the session and is not an access check.
 */
export async function getPrincipal(): Promise<Principal | null> {
  const supabase = await supabaseServer();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (error || !claims?.sub) return null;
  // The token itself is read only after its claims were verified above.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;
  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    assuranceLevel: claims.aal === "aal2" ? "aal2" : "aal1",
    accessToken,
  };
}

/** For pages and actions that need a signed-in person: sends everyone else to the sign-in page. */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) {
    const back = safeNextPath((await headers()).get("x-next-path"), "");
    redirect(back ? `/sign-in?next=${encodeURIComponent(back)}` : "/sign-in");
  }
  return principal;
}
