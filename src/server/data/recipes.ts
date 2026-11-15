import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";

const money = z.number().nullable();

export const dishTotalsShape = {
  cost_cents: z.number(),
  complete: z.boolean(),
  ingredients_without_price: z.array(z.string()),
  avg_sell_price_cents: money,
  cost_pct_of_price: z.number().nullable(),
  portions: z.number(),
  cost_per_portion_cents: money,
  target_margin_pct: z.number(),
  suggested_price_cents: money,
  price_gap_cents: money,
  price_basis: z.string(),
  as_of: z.string(),
};

export const recipeSummarySchema = z.object({
  menu_item_id: z.string(),
  name: z.string(),
  line_count: z.number(),
  ...dishTotalsShape,
});
export type RecipeSummary = z.infer<typeof recipeSummarySchema>;

export const recipeLineSchema = z.object({
  ingredient_id: z.string(),
  ingredient: z.string(),
  // GET sends a string, a save sends a number: both are kept as text.
  qty_per_serve: z.union([z.string(), z.number()]).transform(String),
  unit: z.string(),
  usable_pct: z.number().nullable(),
  cost_cents: z.number().nullable(),
  price_note: z.string().nullable(),
  purchase_ids: z.array(z.string()),
});
export type RecipeLine = z.infer<typeof recipeLineSchema>;

export const recipeSchema = z.object({
  menu_item_id: z.string(),
  name: z.string(),
  lines: z.array(recipeLineSchema),
  ...dishTotalsShape,
});
export type Recipe = z.infer<typeof recipeSchema>;

/** What a save answers: the dish as above, plus what happened. */
export const recipeSavedSchema = recipeSchema.extend({
  result: z.unknown().optional(),
  changed: z.boolean().optional(),
});

const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  });

const path = (venueId: string) => ({ path: { venue_id: venueId } });

export function listRecipes(
  token: string,
  venueId: string,
  offset: number,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/recipes", {
      params: { ...{ path: { venue_id: venueId } }, query: { offset } },
    }),
    pageOf(recipeSummarySchema),
    next,
  );
}

export function getRecipe(
  token: string,
  venueId: string,
  menuItemId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/recipes/{menu_item_id}", {
      params: { path: { venue_id: venueId, menu_item_id: menuItemId } },
    }),
    recipeSchema,
    next,
  );
}

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string().nullable(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export function listIngredients(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/ingredients", {
      params: path(venueId),
    }),
    z.array(ingredientSchema),
    next,
  );
}

export const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  label: z.string(),
  help: z.string(),
  sales_lines: z.number(),
  gross_cents: z.number(),
  has_recipe: z.boolean(),
  spellings: z.array(z.string()),
  merged_into: z.unknown().optional(),
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export function listMenuItems(
  token: string,
  venueId: string,
  status: "new" | "all",
  offset: number,
  next: string,
  limit = 50,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/menu-items", {
      params: { path: { venue_id: venueId }, query: { status, limit, offset } },
    }),
    pageOf(menuItemSchema),
    next,
  );
}

export const coverageSchema = z.object({
  from: z.string(),
  to: z.string(),
  share_of_sales_pct: z.number().nullable(),
  dishes_without_recipe: z.array(
    z.object({ name: z.string(), gross_cents: z.number() }),
  ),
});

export function getCoverage(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/recipes/coverage", {
      params: path(venueId),
    }),
    coverageSchema,
    next,
  );
}

export const importAnswerSchema = z.object({
  added: z.number(),
  changed: z.number(),
  unchanged: z.number(),
  lines_skipped: z.number(),
  ingredients_not_found: z.array(z.string()),
});
export type ImportAnswer = z.infer<typeof importAnswerSchema>;
