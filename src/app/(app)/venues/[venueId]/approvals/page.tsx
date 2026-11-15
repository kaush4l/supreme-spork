import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { openOffers, pendingRequests } from "@/server/data/approvals";
import { formatDay, formatSpan } from "@/server/format";
import { ApprovalsInbox, type OfferView, type RequestView } from "./inbox";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/approvals`;
  const token = principal.accessToken;
  const [me, requests, offers] = await Promise.all([
    fetchMe(backend(token)),
    pendingRequests(token, venueId, here),
    openOffers(token, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";

  const requestViews: RequestView[] = requests.map((r) => {
    const d = r.details;
    const who = r.staff_name ?? "Someone";
    const when =
      d.start && d.end
        ? `${formatDay(d.start, tz)}, ${formatSpan(d.start, d.end, tz)}${d.position ? ` (${d.position})` : ""}`
        : null;
    let title = r.description;
    if (r.kind === "leave" && d.start_date && d.end_date)
      title =
        d.start_date === d.end_date
          ? `${who} asks for leave on ${d.start_date}`
          : `${who} asks for leave from ${d.start_date} to ${d.end_date}`;
    if (r.kind === "swap" && d.to_staff_name && when)
      title = `${who} asks ${d.to_staff_name} to take their shift: ${when}`;
    return {
      id: r.id,
      kind: r.kind,
      title,
      reason: d.reason ?? null,
    };
  });

  const offerViews: OfferView[] = offers.map((o) => ({
    id: o.id,
    title: `${formatDay(o.shift.start, tz)}, ${formatSpan(o.shift.start, o.shift.end, tz)}${o.shift.position ? ` (${o.shift.position})` : ""}`,
    context:
      o.kind === "open"
        ? "Open shift offered to the team"
        : `${o.offered_by ?? "Someone"} gave this shift to the pool`,
    claims: o.claims.map((c) => ({
      id: c.id,
      name: c.name,
      decision: c.decision ?? null,
    })),
  }));

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Approvals</Heading>
      {requestViews.length === 0 && offerViews.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nothing is waiting for you.
        </Text>
      ) : null}
      <ApprovalsInbox
        venueId={venueId}
        requests={requestViews}
        offers={offerViews}
      />
    </VStack>
  );
}
