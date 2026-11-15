import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { backend } from "@/server/api/backend";
import { fetchMe } from "@/server/api/me";
import { requirePrincipal } from "@/server/auth/principal";
import { myLists } from "@/server/data/me";
import { formatDay, formatTime } from "@/server/format";
import { groupMyLists, statusWord } from "./words";

export const metadata = { title: "My checklists" };

export default async function MyListsPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/lists`;
  const [me, lists] = await Promise.all([
    fetchMe(backend(principal.accessToken)),
    myLists(principal.accessToken, venueId, here),
  ]);
  const tz =
    me.venues.find((v) => v.id === venueId)?.timezone ?? "Australia/Sydney";
  const groups = groupMyLists(lists);
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>My checklists</Heading>
      {groups.length === 0 ? (
        <Text type="supporting" color="secondary">
          You have no checklists right now.
        </Text>
      ) : (
        groups.map((g) => (
          <VStack key={g.title} gap={2} hAlign="stretch">
            <Heading level={2}>{g.title}</Heading>
            {g.lists.map((l) => (
              <Card key={l.id} padding={4}>
                <VStack gap={1} hAlign="start">
                  <Link href={`/venues/${venueId}/lists/${l.id}`}>
                    {l.name}
                  </Link>
                  <Text type="supporting" color="secondary">
                    {statusWord(l.status)}
                    {l.status === "done" && l.completed_at
                      ? `, finished ${formatDay(l.completed_at, tz)} ${formatTime(l.completed_at, tz)}`
                      : `, due ${formatDay(l.due_at, tz)} ${formatTime(l.due_at, tz)}`}
                  </Text>
                </VStack>
              </Card>
            ))}
          </VStack>
        ))
      )}
    </VStack>
  );
}
