import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myOffer } from "@/server/data/my-offers";
import { formatDay, formatHours, formatSpan } from "@/server/format";
import { offerState } from "../../group";
import { AskButton } from "./ask-button";

export const metadata = { title: "Shift offer" };

export default async function OfferPage({
  params,
}: {
  params: Promise<{ venueId: string; offerId: string }>;
}) {
  const { venueId, offerId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(offerId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/shifts/offers/${offerId}`;
  // a 404 from the backend (never told about this offer) is the standard not-found page
  const [me, offer] = await Promise.all([
    fetchMe(backend(token)),
    myOffer(token, venueId, offerId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const open = offer.status === "open";
  const shift = offer.shift;
  const gotIt = offer.my_outcome === "got_it";

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Shift offer</Heading>
      <Heading level={2}>{offer.label}</Heading>
      <Card padding={4}>
        <VStack gap={2} hAlign="stretch">
          <Text type="body">
            {formatDay(shift.start, tz)},{" "}
            {formatSpan(shift.start, shift.end, tz)}
          </Text>
          <Text type="supporting" color="secondary">
            {[
              shift.position,
              shift.hours != null ? formatHours(shift.hours) : null,
              offer.offered_by && !offer.mine
                ? `offered by ${offer.offered_by}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {open && offer.can_claim ? (
            <Text type="supporting" color="secondary">
              {offerState({ ...offer, my_claim: offer.my_claim ?? null })}
            </Text>
          ) : null}
        </VStack>
      </Card>
      {open && offer.can_claim ? (
        <AskButton venueId={venueId} offerId={offerId} />
      ) : null}
      <Link href={`/venues/${venueId}/shifts`}>
        {gotIt || offer.mine ? "See my shifts" : "See open shifts"}
      </Link>
    </VStack>
  );
}
