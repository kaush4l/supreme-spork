import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { authBaseUrl, parseEnv } from "../env-schema";
import { cookieName, hardenCookie } from "./cookies";

/**
 * Keeps the session fresh for a page request: an expired access token is renewed with the refresh token and the new
 * cookies go to both the request (so this render sees them) and the response (so the browser keeps them). This is
 * not an access check. It does nothing for a request with no session cookie.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  const production = process.env.NODE_ENV === "production";
  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith(cookieName(production)));
  if (!hasSession) return;
  const { AUTH_URL, AUTH_ANON_KEY } = parseEnv(process.env);
  const supabase = createServerClient(authBaseUrl(AUTH_URL), AUTH_ANON_KEY, {
    cookieOptions: { name: cookieName(production) },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, hardenCookie(options, production));
        }
      },
    },
  });
  await supabase.auth.getClaims();
}
