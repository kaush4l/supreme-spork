const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The venue named in `/venues/{venueId}/dockets/send/file`, or null if the path is anything else. */
export function uploadTarget(pathname: string): { venueId: string } | null {
  const m = pathname.split("/").filter(Boolean);
  if (
    m.length !== 5 ||
    m[0] !== "venues" ||
    m[2] !== "dockets" ||
    m[3] !== "send" ||
    m[4] !== "file"
  )
    return null;
  const venueId = m[1] ?? "";
  return UUID.test(venueId) ? { venueId } : null;
}
