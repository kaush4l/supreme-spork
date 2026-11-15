import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { formatMoney } from "@/server/format";

type Figures = {
  cost_cents: number;
  complete: boolean;
  ingredients_without_price: string[];
  avg_sell_price_cents: number | null;
  cost_pct_of_price: number | null;
  portions: number;
  cost_per_portion_cents: number | null;
  target_margin_pct: number;
  suggested_price_cents: number | null;
  price_gap_cents: number | null;
};

const money = (cents: number | null) =>
  cents === null ? "not known yet" : formatMoney(cents);

/** The figures the API sends for a dish, in plain words. Nothing here is worked out by the screen. */
export function DishFigures({ dish }: { dish: Figures }) {
  return (
    <VStack gap={1} hAlign="stretch">
      {dish.complete ? null : (
        <Text type="body">
          Not complete: an ingredient has no price yet
          {dish.ingredients_without_price.length > 0
            ? ` (${dish.ingredients_without_price.join(", ")})`
            : ""}
          .
        </Text>
      )}
      <Text type="body">Costs to make: {formatMoney(dish.cost_cents)}</Text>
      <Text type="body">
        Portions the recipe makes: {dish.portions}. Cost per portion:{" "}
        {money(dish.cost_per_portion_cents)}
      </Text>
      <Text type="body">
        Average selling price: {money(dish.avg_sell_price_cents)}
        {dish.cost_pct_of_price !== null
          ? `. Cost is ${dish.cost_pct_of_price}% of the price`
          : ""}
      </Text>
      <Text type="body">
        Suggested price for a {dish.target_margin_pct}% margin:{" "}
        {money(dish.suggested_price_cents)}
        {dish.price_gap_cents !== null
          ? `. Gap to your price: ${formatMoney(dish.price_gap_cents)}`
          : ""}
      </Text>
    </VStack>
  );
}
