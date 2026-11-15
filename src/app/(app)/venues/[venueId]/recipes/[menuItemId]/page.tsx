import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { myRights } from "@/server/data/me";
import { getRecipe, listIngredients } from "@/server/data/recipes";
import { isManager } from "@/server/nav";
import { RecipeEditor } from "./recipe-editor";

export const metadata = { title: "Recipe" };

export default async function RecipePage({
  params,
}: {
  params: Promise<{ venueId: string; menuItemId: string }>;
}) {
  const { venueId, menuItemId } = await params;
  if (!z.uuid().safeParse(venueId).success) notFound();
  if (!z.uuid().safeParse(menuItemId).success) notFound();
  const principal = await requirePrincipal();
  const here = `/venues/${venueId}/recipes/${menuItemId}`;
  const token = principal.accessToken;
  const [rights, dish] = await Promise.all([
    myRights(token, venueId, here),
    getRecipe(token, venueId, menuItemId, here),
  ]);
  const canEdit = isManager(rights);
  const ingredients = canEdit
    ? await listIngredients(token, venueId, here)
    : [];
  return (
    <VStack gap={4} hAlign="stretch">
      <Link href={`/venues/${venueId}/recipes`}>All recipes</Link>
      <RecipeEditor
        venueId={venueId}
        menuItemId={menuItemId}
        initial={dish}
        canEdit={canEdit}
        ingredients={ingredients}
      />
    </VStack>
  );
}
