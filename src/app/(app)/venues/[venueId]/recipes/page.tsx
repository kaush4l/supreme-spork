import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { listRecipes } from "@/server/data/recipes";
import { DishFigures } from "./dish-figures";

export const metadata = { title: "Recipes" };

export default async function RecipesPage({
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
  const here = `/venues/${venueId}/recipes`;
  const page = await listRecipes(principal.accessToken, venueId, offset, here);
  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>Recipes</Heading>
      <HStack gap={4} wrap="wrap">
        <Link href={`${here}/new-dishes`}>New dishes to confirm</Link>
        <Link href={`${here}/coverage`}>
          How much of your sales has a recipe
        </Link>
        <Link href={`${here}/import`}>Import recipes</Link>
      </HStack>
      {page.items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No dishes have a recipe yet. Import recipes to see what each dish
          costs to make.
        </Text>
      ) : null}
      {page.items.map((d) => (
        <Card key={d.menu_item_id} padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Heading level={2}>
              <Link href={`${here}/${d.menu_item_id}`}>{d.name}</Link>
            </Heading>
            <Text type="supporting" color="secondary">
              {d.line_count} ingredients
            </Text>
            <DishFigures dish={d} />
          </VStack>
        </Card>
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
