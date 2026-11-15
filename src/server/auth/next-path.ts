/**
 * Where to go after signing in. The path comes from a query string, so it is attacker-controlled: only a plain path on
 * this site is followed (an open redirect to another site is how a phishing link borrows this app's sign-in page).
 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512)
    return fallback;
  if (!raw.startsWith("/")) return fallback; // not a path: "https://evil.example", "javascript:...", "evil.example"
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback; // protocol-relative: "//evil.example"
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback; // control characters and backslashes (browsers read \ as /)
  try {
    const decoded = decodeURIComponent(raw); // a proxy or framework that decodes first must see the same thing we checked
    if (decoded.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(decoded))
      return fallback;
  } catch {
    return fallback; // malformed escape
  }
  try {
    const parsed = new URL(raw, "https://placeholder.invalid");
    if (parsed.origin !== "https://placeholder.invalid") return fallback;
    if (parsed.pathname.startsWith("/auth/") || parsed.pathname === "/sign-in")
      return fallback; // never loop through auth
  } catch {
    return fallback;
  }
  return raw;
}
