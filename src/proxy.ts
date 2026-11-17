import { type NextRequest, NextResponse } from "next/server";
import { refreshSession } from "@/server/auth/refresh";
import { buildCsp, newNonce } from "@/server/csp";

/**
 * Runs before every page request (Next.js 16 `proxy`, the former middleware). It sets the Content-Security-Policy with a
 * fresh nonce and keeps a signed-in session fresh. It is NOT where access is decided: every page, Server Action and Route Handler checks the session
 * itself, because a matcher can skip a path and the framework has had proxy-bypass advisories.
 */
export async function proxy(request: NextRequest) {
  // Prototype routes (see src/proto/guard.ts): disabled answers 404 here, before any auth work. Enabled routes are
  // synthetic, so they skip the session refresh and make no call to the login service. Real routes are untouched.
  const path = request.nextUrl.pathname;
  const isProto = path === "/proto" || path.startsWith("/proto/");
  if (isProto && process.env.PROTO_ENABLED !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }
  const nonce = newNonce();
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    // Checklist photos come from the backend's signed storage links (FILES_URL: their public origin).
    imgSources: process.env.FILES_URL ? [process.env.FILES_URL] : [],
    // The CAPTCHA widget is a frame from Cloudflare, and only when a site key is configured.
    frameSources: process.env.TURNSTILE_SITE_KEY
      ? ["https://challenges.cloudflare.com"]
      : [],
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // So a page that needs a sign-in can send the person back to it afterwards (checked by safeNextPath).
  requestHeaders.set(
    "x-next-path",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (!isProto) await refreshSession(request, response);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-192.png|icon-512.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
