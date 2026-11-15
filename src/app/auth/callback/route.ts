import { type NextRequest, NextResponse } from "next/server";
import { callbackTarget } from "@/server/auth/callback-target";
import { supabaseServer } from "@/server/auth/supabase";
import { env } from "@/server/env";

/**
 * The address a link in an email lands on after the login service has checked it. A confirmation only needs to send the
 * person on to sign in (the service already marked the address confirmed); a password-reset link carries a code that is
 * exchanged for a session in THIS browser (the one that asked), and a link opened in another browser fails cleanly.
 */
export async function GET(request: NextRequest) {
  const base = env().SITE_URL;
  const target = callbackTarget(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  if (target === "/reset-password") {
    if (!code)
      return NextResponse.redirect(new URL("/forgot-password?expired=1", base));
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error)
      return NextResponse.redirect(new URL("/forgot-password?expired=1", base));
  }
  return NextResponse.redirect(new URL(target, base));
}
