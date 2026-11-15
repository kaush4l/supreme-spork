const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The venue named in `/venues/{venueId}/expiry/upload`, or null if the path is anything else. */
export function uploadTarget(pathname: string): { venueId: string } | null {
  const m = pathname.split("/").filter(Boolean);
  if (
    m.length !== 4 ||
    m[0] !== "venues" ||
    m[2] !== "expiry" ||
    m[3] !== "upload"
  )
    return null;
  const venueId = m[1] ?? "";
  return UUID.test(venueId) ? { venueId } : null;
}
