import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "../env";
import { authBaseUrl } from "../env-schema";
import { cookieName, hardenCookie } from "./cookies";

const production = () => process.env.NODE_ENV === "production";

/**
 * The login-service client for the current request, keeping its session in this app's cookies. Server only: the
 * browser client of @supabase/ssr is never used, because it needs script-readable cookies.
 */
export async function supabaseServer() {
  const store = await cookies();
  const { AUTH_URL, AUTH_ANON_KEY } = env();
  return createServerClient(authBaseUrl(AUTH_URL), AUTH_ANON_KEY, {
    cookieOptions: { name: cookieName(production()) },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list)
            store.set(name, value, hardenCookie(options, production()));
        } catch {
          // Called from a Server Component, which cannot set cookies: proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
