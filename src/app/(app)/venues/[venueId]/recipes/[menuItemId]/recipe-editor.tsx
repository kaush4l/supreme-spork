"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useState, useTransition } from "react";
import type { Ingredient, Recipe, RecipeLine } from "@/server/data/recipes";
import { formatMoney } from "@/server/format";
import { useGuard } from "../../bills/guarded";
import { DishFigures } from "../dish-figures";
import { saveLine, saveYield } from "./actions";

type Props = {
  venueId: string;
  menuItemId: string;
  initial: Recipe;
  canEdit: boolean;
  ingredients: Ingredient[];
};

/** One dish: what goes in, what it costs, and (for those who may) the forms to change it. The dish shown after a save is the one the API sends back. */
export function RecipeEditor({
  venueId,
  menuItemId,
  initial,
  canEdit,
  ingredients,
}: Props) {
  const [dish, setDish] = useState<Recipe>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const done = (next: Recipe, what: string) => {
    setDish({
      menu_item_id: next.menu_item_id,
      name: next.name,
      lines: next.lines,
      cost_cents: next.cost_cents,
      complete: next.complete,
      ingredients_without_price: next.ingredients_without_price,
      avg_sell_price_cents: next.avg_sell_price_cents,
      cost_pct_of_price: next.cost_pct_of_price,
      portions: next.portions,
      cost_per_portion_cents: next.cost_per_portion_cents,
      target_margin_pct: next.target_margin_pct,
      suggested_price_cents: next.suggested_price_cents,
      price_gap_cents: next.price_gap_cents,
      price_basis: next.price_basis,
      as_of: next.as_of,
    });
    setMessage(null);
    setSaved(what);
  };
  const failed = (text: string) => {
    setSaved(null);
    setMessage(text);
  };
  const inDish = new Set(dish.lines.map((l) => l.ingredient_id));
  const free = ingredients.filter((i) => !inDish.has(i.id));

  return (
    <VStack gap={4} hAlign="stretch">
      <Heading level={1}>{dish.name}</Heading>
      {message ? <Banner status="error" title={message} /> : null}
      {saved ? <Banner status="success" title={saved} /> : null}
      <Card padding={4}>
        <VStack gap={2} hAlign="stretch">
          <Heading level={2}>Cost</Heading>
          <DishFigures dish={dish} />
          <Text type="supporting" color="secondary">
            {dish.price_basis}
          </Text>
          <Text type="supporting" color="secondary">
            Prices as of {dish.as_of}.
          </Text>
        </VStack>
      </Card>
      {canEdit ? (
        <YieldForm
          venueId={venueId}
          menuItemId={menuItemId}
          portions={dish.portions}
          onDone={done}
          onFail={failed}
        />
      ) : null}
      <Heading level={2}>Ingredients</Heading>
      {dish.lines.length === 0 ? (
        <Text type="supporting" color="secondary">
          This dish has no ingredients in its recipe.
        </Text>
      ) : null}
      {dish.lines.map((line) => (
        <LineCard
          key={`${line.ingredient_id}-${line.qty_per_serve}-${line.usable_pct}`}
          line={line}
          venueId={venueId}
          menuItemId={menuItemId}
          canEdit={canEdit}
          onDone={done}
          onFail={failed}
        />
      ))}
      {canEdit ? (
        <AddLine
          venueId={venueId}
          menuItemId={menuItemId}
          options={free}
          onDone={done}
          onFail={failed}
        />
      ) : null}
    </VStack>
  );
}

type Callbacks = {
  onDone: (next: Recipe, what: string) => void;
  onFail: (text: string) => void;
};

function LineCard({
  line,
  venueId,
  menuItemId,
  canEdit,
  onDone,
  onFail,
}: Callbacks & {
  line: RecipeLine;
  venueId: string;
  menuItemId: string;
  canEdit: boolean;
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [qty, setQty] = useState(line.qty_per_serve);
  const [pct, setPct] = useState(
    line.usable_pct === null ? "" : String(line.usable_pct),
  );
  const [pending, start] = useTransition();
  const guard = useGuard();

  const send = (nextQty: string, what: string) =>
    start(
      guard(async () => {
        if (!/^\d+(\.\d+)?$/.test(nextQty.trim())) {
          onFail("Type the amount as a number, for example 150 or 0.5.");
          return;
        }
        if (pct.trim() !== "" && !/^\d+(\.\d+)?$/.test(pct.trim())) {
          onFail("Type the usable share as a number, for example 85.");
          return;
        }
        const result = await saveLine({
          venueId,
          menuItemId,
          ingredientId: line.ingredient_id,
          key,
          qty: nextQty.trim(),
          unit: line.unit,
          ...(pct.trim() !== "" ? { usablePct: pct.trim() } : {}),
        });
        if (!result.ok) return onFail(result.error.message);
        setKey(crypto.randomUUID());
        onDone(result.data, what);
      }),
    );

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <Heading level={3}>{line.ingredient}</Heading>
        <Text type="body">
          {line.qty_per_serve} {line.unit}, {line.usable_pct ?? 100}% usable.
          Cost:{" "}
          {line.cost_cents === null
            ? "no price yet"
            : formatMoney(line.cost_cents)}
        </Text>
        {line.price_note ? (
          <Text type="supporting" color="secondary">
            {line.price_note}
          </Text>
        ) : null}
        <Text type="supporting" color="secondary">
          {line.purchase_ids.length === 0
            ? "No docket has priced this yet."
            : `Price taken from ${line.purchase_ids.length} docket line${line.purchase_ids.length === 1 ? "" : "s"}.`}
        </Text>
        {canEdit ? (
          <VStack gap={2} hAlign="stretch">
            <TextInput
              label={`Amount in the dish (${line.unit})`}
              value={qty}
              onChange={setQty}
              inputMode="decimal"
              size="lg"
            />
            <TextInput
              label="Usable share (percent)"
              value={pct}
              onChange={setPct}
              inputMode="decimal"
              isOptional
              size="lg"
            />
            <HStack gap={2} wrap="wrap">
              <Button
                label={`Save ${line.ingredient}`}
                variant="primary"
                isLoading={pending}
                onClick={() => send(qty, `Saved ${line.ingredient}.`)}
              />
              <Button
                label={`Remove ${line.ingredient}`}
                isDisabled={pending}
                onClick={() => send("0", `Removed ${line.ingredient}.`)}
              />
            </HStack>
          </VStack>
        ) : null}
      </VStack>
    </Card>
  );
}

function AddLine({
  venueId,
  menuItemId,
  options,
  onDone,
  onFail,
}: Callbacks & {
  venueId: string;
  menuItemId: string;
  options: Ingredient[];
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [id, setId] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [pending, start] = useTransition();
  const guard = useGuard();

  const pick = (value: string | null) => {
    const next = value ?? undefined;
    setId(next);
    const found = options.find((o) => o.id === next);
    if (found?.unit) setUnit(found.unit);
  };

  const add = () =>
    start(
      guard(async () => {
        if (!id) return onFail("Choose an ingredient to add.");
        if (!/^\d+(\.\d+)?$/.test(qty.trim()) || Number(qty) <= 0)
          return onFail("Type how much goes in, as a number above 0.");
        if (!unit.trim()) return onFail("Type the unit, for example g or kg.");
        const result = await saveLine({
          venueId,
          menuItemId,
          ingredientId: id,
          key,
          qty: qty.trim(),
          unit: unit.trim(),
        });
        if (!result.ok) return onFail(result.error.message);
        setKey(crypto.randomUUID());
        setId(undefined);
        setQty("");
        setUnit("");
        onDone(result.data, "Ingredient added.");
      }),
    );

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Add an ingredient</Heading>
        {options.length === 0 ? (
          <Text type="supporting" color="secondary">
            Every ingredient a docket has bought is already in this dish.
          </Text>
        ) : (
          <Selector
            label="Ingredient"
            placeholder="Search for an ingredient"
            hasSearch
            options={options.map((o) => ({
              value: o.id,
              label: o.unit ? `${o.name} (${o.unit})` : o.name,
            }))}
            value={id}
            onChange={pick}
          />
        )}
        <TextInput
          label="Amount in the dish"
          value={qty}
          onChange={setQty}
          inputMode="decimal"
          size="lg"
        />
        <TextInput label="Unit" value={unit} onChange={setUnit} size="lg" />
        <HStack gap={2}>
          <Button
            label="Add ingredient"
            variant="primary"
            isLoading={pending}
            isDisabled={options.length === 0}
            onClick={add}
          />
        </HStack>
      </VStack>
    </Card>
  );
}

function YieldForm({
  venueId,
  menuItemId,
  portions,
  onDone,
  onFail,
}: Callbacks & { venueId: string; menuItemId: string; portions: number }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [value, setValue] = useState(String(portions));
  const [pending, start] = useTransition();
  const guard = useGuard();

  const save = () =>
    start(
      guard(async () => {
        if (!/^\d+(\.\d+)?$/.test(value.trim()) || Number(value) <= 0)
          return onFail("Type the portions as a number above 0.");
        const result = await saveYield({
          venueId,
          menuItemId,
          key,
          portions: value.trim(),
        });
        if (!result.ok) return onFail(result.error.message);
        setKey(crypto.randomUUID());
        setValue(String(result.data.portions));
        onDone(result.data, "Portions saved.");
      }),
    );

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Portions</Heading>
        <TextInput
          label="How many portions this recipe makes"
          value={value}
          onChange={setValue}
          inputMode="decimal"
          size="lg"
        />
        <HStack gap={2}>
          <Button
            label="Save portions"
            variant="primary"
            isLoading={pending}
            onClick={save}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
