import "server-only";
import { headers } from "next/headers";
import { env } from "../env";
import { authBaseUrl } from "../env-schema";
import { clientAddress } from "./client-ip";

/**
 * The login service's recovery-code endpoints (GoTrue 2.197). They are not in supabase-js, so they are called here, from
 * the server only, with the signed-in person's own token. Codes are returned once, by `make`, and never again.
 */
export type RecoveryStatus = { total: number; remaining: number } | null;
type Made = { codes: string[] };
export type RecoveryFailure = { status: number; code: string | null };

async function call(
  accessToken: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const { AUTH_URL, AUTH_ANON_KEY } = env();
  const address = clientAddress(await headers());
  const response = await fetch(
    `${authBaseUrl(AUTH_URL)}/auth/v1/factors/recovery-codes${path}`,
    {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: AUTH_ANON_KEY,
        "Content-Type": "application/json",
        ...(address ? { "X-Minder-Client-IP": address } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const json = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { status: response.status, json };
}

const codeOf = (json: Record<string, unknown>) =>
  typeof json.error_code === "string" ? json.error_code : null;

/** How many codes the person has left, or null when they have none yet. */
export async function recoveryStatus(
  accessToken: string,
): Promise<RecoveryStatus> {
  const { status, json } = await call(accessToken, "GET", "");
  if (status !== 200) return null;
  const total = Number(json.total);
  const remaining = Number(json.remaining);
  return Number.isFinite(total) && Number.isFinite(remaining)
    ? { total, remaining }
    : null;
}

/** A fresh set (the first, or replacing the old set). Needs a session that has passed the second factor. */
export async function makeRecoveryCodes(
  accessToken: string,
  replace: boolean,
): Promise<Made | RecoveryFailure> {
  const { status, json } = await call(
    accessToken,
    "POST",
    replace ? "/regenerate" : "",
    replace ? undefined : {},
  );
  const codes = json.codes;
  if (
    status === 200 &&
    Array.isArray(codes) &&
    codes.every((c) => typeof c === "string")
  )
    return { codes: codes as string[] };
  return { status, code: codeOf(json) };
}

/** Sign in with one code: on success the login service answers with a new session at the second-factor level. */
export async function redeemRecoveryCode(
  accessToken: string,
  code: string,
): Promise<{ accessToken: string; refreshToken: string } | RecoveryFailure> {
  const { status, json } = await call(accessToken, "POST", "/verify", { code });
  if (
    status === 200 &&
    typeof json.access_token === "string" &&
    typeof json.refresh_token === "string"
  )
    return { accessToken: json.access_token, refreshToken: json.refresh_token };
  return { status, code: codeOf(json) };
}
