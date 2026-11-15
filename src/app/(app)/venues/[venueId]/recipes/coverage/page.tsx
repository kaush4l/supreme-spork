import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { getCoverage } from "@/server/data/recipes";
import { formatMoney } from "@/server/format";

export const metadata = { title: "Recipe coverage" };

export default async function CoveragePage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/recipes/coverage`;
  const c = await getCoverage(principal.accessToken, venueId, here);
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/recipes`}>All recipes</Link>
      <Heading level={1}>Recipe coverage</Heading>
      <Text type="supporting" color="secondary">
        Sales from {c.from} to {c.to}.
      </Text>
      <Card padding={4}>
        <Text type="body">
          {c.share_of_sales_pct === null
            ? "There are no sales in this period yet."
            : `${c.share_of_sales_pct}% of what you sold has a recipe.`}
        </Text>
      </Card>
      <Heading level={2}>Dishes sold without a recipe</Heading>
      {c.dishes_without_recipe.length === 0 ? (
        <Text type="supporting" color="secondary">
          Every dish that sold has a recipe.
        </Text>
      ) : (
        <Card padding={4}>
          <VStack gap={2}>
            {c.dishes_without_recipe.map((d) => (
              <Text key={d.name} type="body">
                {d.name}: {formatMoney(d.gross_cents)} sold
              </Text>
            ))}
          </VStack>
        </Card>
      )}
    </VStack>
  );
}
