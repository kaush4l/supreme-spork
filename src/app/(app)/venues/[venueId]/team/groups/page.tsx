import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { listStaff } from "@/server/data/team";
import { listGroups } from "@/server/data/team-extras";
import { GroupsView } from "./groups-view";

export const metadata = { title: "Staff groups" };

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/team/groups`;
  const token = principal.accessToken;
  const groups = await listGroups(token, venueId, here);
  // The staff list needs a different right; a manager of the roster without it just cannot pick people here.
  const staff = await listStaff(token, venueId, here).catch(() => []);
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/team`}>Back to the team</Link>
      <Heading level={1}>Staff groups</Heading>
      <Text type="supporting" color="secondary">
        Groups help when you build the roster, for example Bar or Kitchen.
      </Text>
      <GroupsView
        venueId={venueId}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          members: g.members.map((m) => ({
            staffId: m.staff_id,
            name: m.name,
            active: m.active,
          })),
        }))}
        people={staff
          .filter((s) => s.active)
          .map((s) => ({ value: s.id, label: s.name }))}
      />
    </VStack>
  );
}
