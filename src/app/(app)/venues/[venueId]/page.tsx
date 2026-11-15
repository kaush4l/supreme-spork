import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { landingPath } from "@/server/nav";

export const metadata = { title: "Venue" };

/** The venue's front door: send each person to their first page (managers to the board, staff to Today). */
export default async function VenuePage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const rights = await myRights(
    principal.accessToken,
    venueId,
    `/venues/${venueId}`,
  );
  const path = landingPath(rights);
  if (!path)
    return (
      <VStack gap={4} padding={6} hAlign="stretch">
        <Link href="/">All venues</Link>
        <Heading level={1}>Venue</Heading>
        <Card padding={4}>
          <Text type="body">
            There is nothing for you to do on this screen yet. The screens for
            your role are still being built.
          </Text>
        </Card>
      </VStack>
    );
  redirect(`/venues/${venueId}${path}`);
}
