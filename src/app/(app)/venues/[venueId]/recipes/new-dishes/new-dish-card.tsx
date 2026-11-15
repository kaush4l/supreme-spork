"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MenuItem } from "@/server/data/recipes";
import { formatMoney } from "@/server/format";
import { useGuard } from "../../bills/guarded";
import { confirmDish, mergeDish } from "./actions";

type Step = "idle" | "pick" | "ask";

/** One new dish: confirm it, or say it is another spelling of a dish you have (asks first, because its sales move). */
export function NewDishCard({
  venueId,
  dish,
  canEdit,
  targets,
}: {
  venueId: string;
  dish: MenuItem;
  canEdit: boolean;
  targets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [confirmKey, setConfirmKey] = useState(() => crypto.randomUUID());
  const [mergeKey, setMergeKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<Step>("idle");
  const [into, setInto] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guard = useGuard();
  const target = targets.find((t) => t.id === into);

  const confirm = () =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await confirmDish({
          venueId,
          itemId: dish.id,
          key: confirmKey,
        });
        if (!result.ok) return setMessage(result.error.message);
        setConfirmKey(crypto.randomUUID());
        router.refresh();
      }),
    );

  const merge = () =>
    start(
      guard(async () => {
        if (!into) return;
        setMessage(null);
        const result = await mergeDish({
          venueId,
          itemId: dish.id,
          intoId: into,
          key: mergeKey,
        });
        if (!result.ok) {
          setStep("pick");
          return setMessage(result.error.message);
        }
        setMergeKey(crypto.randomUUID());
        router.refresh();
      }),
    );

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <Heading level={2}>{dish.name}</Heading>
        <Text type="body">
          {dish.sales_lines} sales lines, {formatMoney(dish.gross_cents)} sold.
          {dish.has_recipe ? " It has a recipe." : " It has no recipe."}
        </Text>
        {dish.spellings.length > 0 ? (
          <Text type="supporting" color="secondary">
            Written as: {dish.spellings.join(", ")}
          </Text>
        ) : null}
        <Text type="supporting" color="secondary">
          {dish.help}
        </Text>
        {message ? <Banner status="error" title={message} /> : null}
        {canEdit && step === "idle" ? (
          <HStack gap={2} wrap="wrap">
            <Button
              label={`This is a real dish: ${dish.name}`}
              variant="primary"
              isLoading={pending}
              onClick={confirm}
            />
            <Button
              label={`This is another spelling of... (${dish.name})`}
              isDisabled={pending}
              onClick={() => setStep("pick")}
            />
          </HStack>
        ) : null}
        {canEdit && step !== "idle" ? (
          <VStack gap={2} hAlign="stretch">
            <Selector
              label={`${dish.name} is another spelling of`}
              placeholder="Search for a dish"
              hasSearch
              options={targets.map((t) => ({ value: t.id, label: t.name }))}
              value={into}
              onChange={(v) => {
                setInto(v ?? undefined);
                setStep(v ? "ask" : "pick");
              }}
            />
            {step === "ask" && target ? (
              <Banner
                status="warning"
                title={`Move the sales of ${dish.name} to ${target.name}?`}
                description="All its sales and spellings move there. This cannot be put back."
              />
            ) : null}
            <HStack gap={2} wrap="wrap">
              {step === "ask" ? (
                <Button
                  label={`Yes, move the sales of ${dish.name}`}
                  variant="primary"
                  isLoading={pending}
                  onClick={merge}
                />
              ) : null}
              <Button
                label={`Cancel (${dish.name})`}
                isDisabled={pending}
                onClick={() => {
                  setStep("idle");
                  setInto(undefined);
                }}
              />
            </HStack>
          </VStack>
        ) : null}
      </VStack>
    </Card>
  );
}
