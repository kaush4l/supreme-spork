import { Collapsible } from "@astryxdesign/core/Collapsible";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { type Offer, rosterOffers } from "@/server/data/roster-extras";
import { formatDay, formatSpan } from "@/server/format";
import { OfferCard, type OfferLine } from "./offer-card";
import { KIND_WORDS, MODE_WORDS, STATUS_WORDS } from "./words";

export const metadata = { title: "Shift offers" };

const RECENT_DAYS = 14;

export default async function OffersPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/roster/offers`;
  const [me, open, recent] = await Promise.all([
    fetchMe(backend(token)),
    rosterOffers(token, venueId, here),
    rosterOffers(token, venueId, here, RECENT_DAYS),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";

  const line = (o: Offer): OfferLine => ({
    id: o.id,
    title: `${o.shift.position ?? "Shift"}${o.offered_by ? ` (${o.offered_by}'s shift)` : ""}`,
    when: `${formatDay(o.shift.start, tz)}, ${formatSpan(o.shift.start, o.shift.end, tz)}`,
    kindLabel: KIND_WORDS[o.kind] ?? o.kind,
    modeLabel: MODE_WORDS[o.mode] ?? o.mode,
    statusLabel: STATUS_WORDS[o.status] ?? o.status,
    open: o.status === "open",
    shiftCancelled: o.shift.status === "cancelled",
    claims: o.claims.map((c) => ({
      id: c.id,
      name: c.name,
      decision: c.decision,
      note: c.note ?? null,
      whenLabel: formatDay(c.at, tz),
    })),
  });
  const live = open.filter((o) => o.shift.status !== "cancelled");
  const stale = open.filter((o) => o.shift.status === "cancelled");

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Shift offers</Heading>
      <Link href={`/venues/${venueId}/roster`}>Back to the roster</Link>
      <Text type="supporting" color="secondary">
        Open shifts you offered and shifts team members dropped. Offer a shift
        from the roster.
      </Text>
      <VStack gap={2} hAlign="stretch">
        <Heading level={2}>On offer now</Heading>
        {live.length === 0 ? (
          <Text type="body" color="secondary">
            No shifts are on offer right now.
          </Text>
        ) : (
          live.map((o) => (
            <OfferCard key={o.id} venueId={venueId} offer={line(o)} />
          ))
        )}
      </VStack>
      {stale.length > 0 ? (
        <Collapsible
          trigger={
            <Text type="body">{`Offers for cancelled shifts (${stale.length})`}</Text>
          }
          defaultIsOpen={false}
        >
          <VStack gap={2} hAlign="stretch">
            {stale.map((o) => (
              <OfferCard key={o.id} venueId={venueId} offer={line(o)} />
            ))}
          </VStack>
        </Collapsible>
      ) : null}
      <VStack gap={2} hAlign="stretch">
        <Heading level={2}>Settled in the last {RECENT_DAYS} days</Heading>
        {recent.length === 0 ? (
          <Text type="body" color="secondary">
            Nothing was settled recently.
          </Text>
        ) : (
          recent.slice(0, 20).map((o) => (
            <VStack key={o.id} gap={1} hAlign="stretch">
              <Text type="body">
                {o.shift.position ?? "Shift"} · {formatDay(o.shift.start, tz)},{" "}
                {formatSpan(o.shift.start, o.shift.end, tz)}
              </Text>
              <Text type="supporting" color="secondary">
                {STATUS_WORDS[o.status] ?? o.status}
                {o.filled_by ? ` by ${o.filled_by}` : ""}
                {o.decided_at ? ` on ${formatDay(o.decided_at, tz)}` : ""}
                {o.decided_by_name ? ` (decided by ${o.decided_by_name})` : ""}
              </Text>
            </VStack>
          ))
        )}
      </VStack>
    </VStack>
  );
}
