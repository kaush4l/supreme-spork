import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import {
  decidedRequests,
  openOffers,
  pendingRequests,
  settledOffers,
} from "@/server/data/approvals";
import { formatDay, formatSpan, formatTime } from "@/server/format";
import {
  type DecidedItem,
  newestFirst,
  offerOutcome,
  requestOutcome,
} from "./decided";
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
  const [me, requests, offers, decidedReqs, decidedOffs] = await Promise.all([
    fetchMe(backend(token)),
    pendingRequests(token, venueId, here),
    openOffers(token, venueId, here),
    decidedRequests(token, venueId, 14, here),
    settledOffers(token, venueId, 14, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";

  const spanOf = (start: string, end: string, position?: string | null) =>
    `${formatDay(start, tz)}, ${formatSpan(start, end, tz)}${position ? ` (${position})` : ""}`;
  const titleOf = (r: (typeof requests)[number], ask = "asked") => {
    const d = r.details;
    const who = r.staff_name ?? "Someone";
    if (r.kind === "leave" && d.start_date && d.end_date)
      return d.start_date === d.end_date
        ? `${who} ${ask} for leave on ${d.start_date}`
        : `${who} ${ask} for leave from ${d.start_date} to ${d.end_date}`;
    if (r.kind === "swap" && d.to_staff_name && d.start && d.end)
      return `${who} ${ask} ${d.to_staff_name} to take their shift: ${spanOf(d.start, d.end, d.position)}`;
    return r.description;
  };

  const requestViews: RequestView[] = requests.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: titleOf(r, "asks"),
    reason: r.details.reason ?? null,
  }));

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

  const decided = newestFirst([
    ...decidedReqs.map((r) => ({
      id: `r:${r.id}`,
      title: titleOf(r),
      outcome: requestOutcome(r.status, r.decided_by_name),
      at: r.resolved_at ?? r.created_at,
    })),
    ...decidedOffs.map((o) => ({
      id: `o:${o.id}`,
      title: `Shift offer: ${spanOf(o.shift.start, o.shift.end, o.shift.position)}`,
      outcome: offerOutcome(o),
      at: o.decided_at,
    })),
  ] satisfies DecidedItem[]);
  const whenText = (at: string) =>
    `${formatDay(at, tz)}, ${formatTime(at, tz)}`;

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
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Recently decided</Heading>
        {decided.length === 0 ? (
          <Text type="supporting" color="secondary">
            Nothing was decided in the last 14 days.
          </Text>
        ) : (
          decided.map((d) => (
            <Card key={d.id} padding={4}>
              <VStack gap={1} hAlign="stretch">
                <Text type="body">{d.title}</Text>
                <Text type="supporting" color="secondary">
                  {d.outcome} · {whenText(d.at)}
                </Text>
              </VStack>
            </Card>
          ))
        )}
      </VStack>
    </VStack>
  );
}
