import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { listBlackouts } from "@/server/data/team-extras";
import { BlackoutsView } from "./blackouts-view";

export const metadata = { title: "Leave blackout dates" };

export default async function BlackoutsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const items = await listBlackouts(
    principal.accessToken,
    venueId,
    `/venues/${venueId}/team/blackouts`,
  );
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/team`}>Back to the team</Link>
      <Heading level={1}>Leave blackout dates</Heading>
      <Text type="supporting" color="secondary">
        Staff cannot ask for leave on these dates. They see the reason.
      </Text>
      <BlackoutsView
        venueId={venueId}
        items={items.map((b) => ({
          id: b.id,
          start: b.start_date,
          end: b.end_date,
          reason: b.reason,
        }))}
      />
    </VStack>
  );
}
