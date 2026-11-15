import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { isManager, readsBooks } from "@/server/nav";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import recipes" };

export default async function ImportPage({
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
    `/venues/${venueId}/recipes/import`,
  );
  if (!readsBooks(rights)) notFound();
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/recipes`}>All recipes</Link>
      <Heading level={1}>Import recipes</Heading>
      <Text type="body">
        Upload a CSV file with the columns dish, ingredient, qty and unit. One
        line per ingredient. An ingredient that no docket has bought yet is
        skipped; load the file again once its docket is booked. Loading the same
        recipes twice changes nothing.
      </Text>
      {isManager(rights) ? (
        <ImportForm venueId={venueId} />
      ) : (
        <Text type="supporting" color="secondary">
          Only an owner, partner or manager can import recipes.
        </Text>
      )}
    </VStack>
  );
}
