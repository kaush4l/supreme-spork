import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { listMenuItems } from "@/server/data/recipes";
import { isManager } from "@/server/nav";
import { NewDishCard } from "./new-dish-card";

export const metadata = { title: "New dishes" };

export default async function NewDishesPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const query = await searchParams;
  const offset = Math.max(0, Number.parseInt(query.offset ?? "0", 10) || 0);
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/recipes/new-dishes`;
  const token = principal.accessToken;
  const rights = await myRights(token, venueId, here);
  const canEdit = isManager(rights);
  const [page, all] = await Promise.all([
    listMenuItems(token, venueId, "new", offset, here),
    canEdit
      ? listMenuItems(token, venueId, "all", 0, here, 200)
      : Promise.resolve({ items: [] }),
  ]);
  const targets = all.items
    .filter((d) => d.status !== "merged")
    .map((d) => ({ id: d.id, name: d.name }));
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/recipes`}>All recipes</Link>
      <Heading level={1}>New dishes</Heading>
      <Text type="supporting" color="secondary">
        A sales report named these dishes and nobody has answered for them yet.
      </Text>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No new dishes to look at.
        </Text>
      ) : null}
      {page.items.map((d) => (
        <NewDishCard
          key={d.id}
          venueId={venueId}
          dish={d}
          canEdit={canEdit}
          targets={targets.filter((t) => t.id !== d.id)}
        />
      ))}
      {offset > 0 ? (
        <Link href={`${here}?offset=${Math.max(0, offset - page.limit)}`}>
          Earlier ones
        </Link>
      ) : null}
      {offset + page.items.length < page.total ? (
        <Link href={`${here}?offset=${offset + page.limit}`}>More</Link>
      ) : null}
    </VStack>
  );
}
