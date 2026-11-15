import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading } from "@astryxdesign/core/Text";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { fetchCategories } from "@/server/data/bank";
import { AddCategoryForm } from "./add-form";
import { CategoryRow } from "./category-row";

export const metadata = { title: "Categories" };

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  const principal = await requirePrincipal();
  const categories = await fetchCategories(
    principal.accessToken,
    venueId,
    `/venues/${venueId}/bank/categories`,
  );
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/bank`}>Back to questions</Link>
      <Heading level={1}>Categories</Heading>
      <AddCategoryForm venueId={venueId} />
      {categories.map((c) => (
        <CategoryRow
          key={`${c.name}-${c.label}-${c.active}`}
          venueId={venueId}
          name={c.name}
          label={c.label}
          active={c.active}
          isProtected={c.protected}
          inUse={c.in_use}
        />
      ))}
    </VStack>
  );
}
