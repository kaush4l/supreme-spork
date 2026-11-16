import { Badge } from "@astryxdesign/core/Badge";
import { fetchAttention } from "@/server/data/attention";

/**
 * The count on the "Needs attention" item. The backend's `total` is shown as it comes ("100+" when it says the list was
 * cut short). It loads inside a Suspense boundary so the slow call never holds up the page, and it shows nothing when
 * the count is 0 or the call fails: the page itself still reports its own errors.
 */
export async function AttentionBadge({
  token,
  venueId,
}: {
  token: string;
  venueId: string;
}) {
  let label: string;
  try {
    const { total, truncated } = await fetchAttention(
      token,
      venueId,
      `/venues/${venueId}/attention`,
    );
    if (total <= 0) return null;
    label = truncated ? "100+" : String(total);
  } catch {
    return null;
  }
  return <Badge label={label} variant="error" />;
}
