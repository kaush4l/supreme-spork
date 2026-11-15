const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The venue and list named in `/venues/{venueId}/lists/{listId}/photo`, or null if the path is anything else. */
export function photoTarget(
  pathname: string,
): { venueId: string; listId: string } | null {
  const m = pathname.split("/").filter(Boolean);
  if (
    m.length !== 5 ||
    m[0] !== "venues" ||
    m[2] !== "lists" ||
    m[4] !== "photo"
  )
    return null;
  const [venueId, listId] = [m[1] ?? "", m[3] ?? ""];
  return UUID.test(venueId) && UUID.test(listId) ? { venueId, listId } : null;
}
