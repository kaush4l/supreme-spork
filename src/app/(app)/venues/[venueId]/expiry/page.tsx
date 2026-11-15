import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import {
  listExpiryItems,
  listExpiryKinds,
  listPeople,
} from "@/server/data/expiry";
import { myRights } from "@/server/data/me";
import { can } from "@/server/nav";
import { AddItemForm } from "./add-item-form";
import { daysWords } from "./words";

export const metadata = { title: "Licences and expiry" };

export default async function ExpiryPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/expiry`;
  const token = principal.accessToken;
  const rights = await myRights(token, venueId, here);
  const seesHr = can(rights, "hr.files.view");
  const [items, kinds, people] = await Promise.all([
    listExpiryItems(token, venueId, here),
    listExpiryKinds(token, venueId, here),
    seesHr ? listPeople(token, venueId, here) : Promise.resolve([]),
  ]);
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Licences and expiry</Heading>
      <Text type="supporting" color="secondary">
        Things that run out, soonest first.
      </Text>
      {items.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nothing added yet.
        </Text>
      ) : (
        <Card padding={4}>
          <VStack gap={3} hAlign="stretch">
            {items.map((i) => (
              <VStack key={i.id} gap={1}>
                <Link href={`${here}/${i.id}`}>
                  {i.title}
                  {i.staff_name ? ` (${i.staff_name})` : ""}
                </Link>
                <HStack gap={2} wrap="wrap">
                  <Text type="body">{i.status_label}</Text>
                  <Text type="supporting" color="secondary">
                    {i.kind_label} · {i.expires_on} · {daysWords(i.days_left)}
                  </Text>
                </HStack>
              </VStack>
            ))}
          </VStack>
        </Card>
      )}
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Add an item</Heading>
          <AddItemForm
            venueId={venueId}
            kinds={kinds}
            canPerson={seesHr}
            people={people
              .filter((p) => p.active && p.staff_ref)
              .map((p) => ({ ref: p.staff_ref as string, name: p.name }))}
          />
        </VStack>
      </Card>
    </VStack>
  );
}
