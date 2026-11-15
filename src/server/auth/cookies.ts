/**
 * How the session cookies are set. The session lives only in these cookies and they are never readable by script:
 * `HttpOnly`, `SameSite=Lax`, path `/`, at most 30 days, and `Secure` with the `__Host-` prefix in production (the prefix makes the
 * browser refuse a cookie set by another subdomain or without Secure). In development over http the prefix and
 * Secure are off, because `http://localhost` cannot keep them in every browser.
 */
export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
  [key: string]: unknown;
};

/** No session cookie outlives the absolute session limit (30 days, security plan section 9). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function cookieName(production: boolean): string {
  return production ? "__Host-minder-auth" : "minder-auth";
}

export function hardenCookie(
  options: CookieOptions | undefined,
  production: boolean,
): CookieOptions {
  const { domain: _domain, ...rest } = options ?? {};
  // A cookie being deleted keeps maxAge 0; every other one lives at most as long as a session can.
  const maxAge =
    rest.maxAge === 0
      ? 0
      : Math.min(
          rest.maxAge ?? SESSION_MAX_AGE_SECONDS,
          SESSION_MAX_AGE_SECONDS,
        );
  return {
    ...rest,
    maxAge,
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
  };
}
