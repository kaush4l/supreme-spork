import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

/** What a page needs to show the CAPTCHA widget, or nothing when no site key is configured. */
export async function captchaProps(): Promise<
  { siteKey: string; nonce: string | undefined } | undefined
> {
  const siteKey = env().TURNSTILE_SITE_KEY;
  if (!siteKey) return undefined;
  return { siteKey, nonce: (await headers()).get("x-nonce") ?? undefined };
}
