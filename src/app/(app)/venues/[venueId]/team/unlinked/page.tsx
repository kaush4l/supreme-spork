import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { listUnlinked } from "@/server/data/team-extras";
import { formatMoney } from "@/server/format";
import { UnlinkedView } from "./unlinked-view";

export const metadata = { title: "People not on the team" };

export default async function UnlinkedPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const items = await listUnlinked(
    principal.accessToken,
    venueId,
    `/venues/${venueId}/team/unlinked`,
  );
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/team`}>Back to the team</Link>
      <Heading level={1}>People not on the team</Heading>
      <Text type="supporting" color="secondary">
        These people are named in a roster file but have no profile yet.
      </Text>
      <UnlinkedView
        venueId={venueId}
        people={items.map((p) => ({
          ref: p.staff_ref,
          name: p.name,
          positions: p.positions,
          shifts: p.shifts,
          rateLabel:
            p.hourly_cost_cents !== null
              ? `${formatMoney(p.hourly_cost_cents)} an hour`
              : null,
        }))}
      />
    </VStack>
  );
}
