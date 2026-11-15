import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import {
  fetchEntries,
  fetchPickables,
  fetchReasons,
} from "@/server/data/waste";
import { EntryForm } from "./entry-form";
import { entryLine, mayEnter, mayReadReport, seesEveryone } from "./who";

export const metadata = { title: "Waste" };

export default async function WastePage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const parsed = Number(query.offset);
  const offset = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/waste`;
  const rights = await myRights(token, venueId, here);
  const form = mayEnter(rights.roles);
  const [page, items, reasons] = await Promise.all([
    fetchEntries(token, venueId, offset, here),
    form ? fetchPickables(token, venueId, here) : Promise.resolve([]),
    form ? fetchReasons(token, venueId, here) : Promise.resolve([]),
  ]);
  const everyone = seesEveryone(rights.roles);
  const nextOffset = page.offset + page.limit;
  const prevOffset = Math.max(0, page.offset - page.limit);

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Waste</Heading>
      {mayReadReport(rights.roles) ? (
        <Link href={`/venues/${venueId}/waste/report`}>
          See what waste cost
        </Link>
      ) : null}
      {form ? (
        <EntryForm venueId={venueId} items={items} reasons={reasons} />
      ) : null}
      <Heading level={2}>{everyone ? "Entries" : "My entries"}</Heading>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          Nothing has been thrown away in the last four weeks.
        </Text>
      ) : null}
      {page.items.map((e) => (
        <Card key={e.id} padding={3}>
          <VStack gap={1} hAlign="stretch">
            <Link href={`/venues/${venueId}/waste/${e.id}`}>
              {e.item ?? "An item"}: {entryLine(e)}
            </Link>
            <Text type="supporting" color="secondary">
              {e.occurred_on}
              {everyone && e.entered_by_name
                ? `, entered by ${e.entered_by_name}`
                : ""}
              {e.changed ? ", corrected" : ""}
            </Text>
            {e.note ? <Text type="supporting">{e.note}</Text> : null}
          </VStack>
        </Card>
      ))}
      {page.total > page.items.length || page.offset > 0 ? (
        <HStack gap={3}>
          {page.offset > 0 ? (
            <Link href={`/venues/${venueId}/waste?offset=${prevOffset}`}>
              Newer
            </Link>
          ) : null}
          {nextOffset < page.total ? (
            <Link href={`/venues/${venueId}/waste?offset=${nextOffset}`}>
              Older
            </Link>
          ) : null}
        </HStack>
      ) : null}
    </VStack>
  );
}
