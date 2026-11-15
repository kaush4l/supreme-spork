/**
 * Where the link in an email brings a person after the login service has checked it. Only these two places exist, so
 * the `next` in the link (which anyone can edit) can never send a person anywhere else.
 */
const ALLOWED = new Set(["/sign-in?confirmed=1", "/reset-password"]);

export function callbackTarget(raw: string | null | undefined): string {
  return typeof raw === "string" && ALLOWED.has(raw) ? raw : "/";
}
