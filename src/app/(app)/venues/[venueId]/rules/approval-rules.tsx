import { requirePrincipal } from "@/server/auth/principal";
import { approvalListing } from "@/server/data/changes";
import { myRights } from "@/server/data/me";
import { formatMoney } from "@/server/format";
import { ApprovalForm } from "./approval-form";

/**
 * The "what needs approval" section of the rules page. It asks the backend itself (the rules listing the page already
 * read does not keep the approval fields) and draws only the rights the backend says can need approval.
 */
export async function ApprovalRules({ venueId }: { venueId: string }) {
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/rules`;
  const [listing, rights] = await Promise.all([
    approvalListing(principal.accessToken, venueId, here),
    myRights(principal.accessToken, venueId, here),
  ]);
  const lines = listing.items
    .filter((item) => item.approvable)
    .map((item) => ({
      key: item.key,
      label: item.label,
      help: item.help,
      approval: item.approval ?? "off",
    }));
  if (lines.length === 0) return null;
  return (
    <ApprovalForm
      venueId={venueId}
      lines={lines}
      levels={listing.approval_levels}
      limitLabel={`Your own approval limit: ${formatMoney(rights.approval_limit_cents)}.`}
      canEdit={rights.roles.includes("owner")}
    />
  );
}
