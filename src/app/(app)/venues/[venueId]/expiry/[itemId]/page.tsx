import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { getExpiryItem } from "@/server/data/expiry";
import { daysWords } from "../words";
import { ItemActions } from "./item-actions";

export const metadata = { title: "Licence or item" };

export default async function ExpiryItemPage({
  params,
}: {
  params: Promise<{ venueId: string; itemId: string }>;
}) {
  const { venueId, itemId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(itemId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/expiry/${itemId}`;
  const token = principal.accessToken;
  const item = await getExpiryItem(token, venueId, itemId, here);
  // A replaced item answers with the newest version under its own id.
  if (item.id !== itemId) redirect(`/venues/${venueId}/expiry/${item.id}`);
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/expiry`}>All licences and expiry</Link>
      <Heading level={1}>{item.title}</Heading>
      <Text type="body">
        {item.status_label}: {item.kind_label}
        {item.staff_name ? ` for ${item.staff_name}` : ""}, runs out on{" "}
        {item.expires_on} ({daysWords(item.days_left)}).
      </Text>
      <Text type="supporting" color="secondary">
        {item.status_help}
      </Text>
      {item.reference ? (
        <Text type="supporting" color="secondary">
          Number: {item.reference}
        </Text>
      ) : null}
      {item.note ? (
        <Text type="supporting" color="secondary">
          Note: {item.note}
        </Text>
      ) : null}
      <ItemActions
        key={item.id}
        venueId={venueId}
        isPerson={item.scope === "person"}
        item={{
          id: item.id,
          title: item.title,
          reference: item.reference,
          expiresOn: item.expires_on,
          warnDays: item.warn_days,
          note: item.note,
          hasFile: item.document_id !== null,
        }}
      />
    </VStack>
  );
}
