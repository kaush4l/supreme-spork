import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { listPositions, listStaff } from "@/server/data/team";
import { listGroups } from "@/server/data/team-extras";
import { can } from "@/server/nav";
import { AnnouncementForm } from "./announcement-form";

export const metadata = { title: "New announcement" };

export default async function NewAnnouncementPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/announcements/new`;
  const token = principal.accessToken;
  const rights = await myRights(token, venueId, here);
  if (!can(rights, "announcements.send")) notFound();
  const [positions, groups, staff] = await Promise.all([
    listPositions(token, venueId, here),
    listGroups(token, venueId, here),
    listStaff(token, venueId, here),
  ]);
  const choices = {
    // a position is sent by its name
    positions: positions
      .filter((p) => p.active)
      .map((p) => ({ value: p.name, label: p.name })),
    groups: groups
      .filter((g) => g.active)
      .map((g) => ({ value: g.id, label: g.name })),
    // a person is sent by their staff id
    people: staff
      .filter((s) => s.active)
      .map((s) => ({ value: s.id, label: s.name })),
  };
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/announcements`}>All announcements</Link>
      <Heading level={1}>New announcement</Heading>
      <Text type="supporting" color="secondary">
        People with an app login get a notice and can open it here. You can see
        who has read it.
      </Text>
      <AnnouncementForm venueId={venueId} choices={choices} />
    </VStack>
  );
}
