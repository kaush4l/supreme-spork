/**
 * Is this request allowed to change anything? Server Actions get Next.js's own Origin check, but it lets a request with
 * no Origin header through; a Route Handler gets none. So every write is checked here: the browser must say it comes
 * from this site (`Origin`, or `Sec-Fetch-Site: same-origin`), and a request the browser marks cross-site is refused
 * whatever else it says. Reads (GET, HEAD, OPTIONS) are not state changes and pass.
 */
const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isWrite(method: string): boolean {
  return WRITES.has(method.toUpperCase());
}

export function isSameSiteWrite(
  request: { method: string; headers: Headers },
  siteUrl: string,
): boolean {
  if (!isWrite(request.method)) return true;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
    return false;
  const origin = request.headers.get("origin");
  if (origin !== null) {
    try {
      return new URL(origin).origin === new URL(siteUrl).origin;
    } catch {
      return false;
    }
  }
  // No Origin: only a browser that says so itself (same-origin) is believed, never a bare request.
  return fetchSite === "same-origin";
}
