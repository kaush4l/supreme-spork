import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { fetchEntry, fetchReasons } from "@/server/data/waste";
import { entryLine, mayChange } from "../who";
import { ChangeForm } from "./change-form";
import { EntryPhoto } from "./entry-photo";

export const metadata = { title: "Waste entry" };

export default async function WasteEntryPage({
  params,
}: {
  params: Promise<{ venueId: string; entryId: string }>;
}) {
  const { venueId, entryId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(entryId).success) notFound();
  const principal = await requirePrincipal();
  const token = principal.accessToken;
  const here = `/venues/${venueId}/waste/${entryId}`;
  const [rights, entry] = await Promise.all([
    myRights(token, venueId, here),
    fetchEntry(token, venueId, entryId, here),
  ]);
  const mayEdit = mayChange(rights.roles, entry.mine);
  const reasons = mayEdit ? await fetchReasons(token, venueId, here) : [];

  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/waste`}>Back to waste</Link>
      <Heading level={1}>{entry.item ?? "Waste entry"}</Heading>
      <Card padding={4}>
        <VStack gap={1} hAlign="stretch">
          <Text type="body">{entryLine(entry)}</Text>
          <Text type="supporting" color="secondary">
            Thrown away on {entry.occurred_on}
          </Text>
          {entry.entered_by_name ? (
            <Text type="supporting" color="secondary">
              Entered by {entry.entered_by_name}
            </Text>
          ) : null}
          {entry.changed && entry.set_by_name ? (
            <Text type="supporting" color="secondary">
              Corrected by {entry.set_by_name}
            </Text>
          ) : null}
          {entry.note ? <Text type="body">Note: {entry.note}</Text> : null}
          {entry.photo_document_id ? (
            <EntryPhoto
              url={entry.photo_url}
              expiresIn={entry.photo_expires_in_seconds ?? 60}
            />
          ) : null}
        </VStack>
      </Card>
      {mayEdit ? (
        <ChangeForm
          venueId={venueId}
          entry={{
            id: entry.id,
            qty: entry.qty,
            unit: entry.unit,
            itemKind: entry.item_kind,
            reason: entry.reason,
            note: entry.note ?? "",
          }}
          reasons={reasons}
        />
      ) : null}
    </VStack>
  );
}
