"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dollarsToCents } from "@/server/data/money-input";
import { addPosition } from "./actions";

export type PositionLine = {
  id: string;
  name: string;
  rateLabel: string | null;
};

/** The positions and their default rates, and a form to add one. The rate box shows only with the pay right. */
export function PositionsCard({
  venueId,
  positions,
  canPay,
}: {
  venueId: string;
  positions: PositionLine[];
  canPay: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = () =>
    start(async () => {
      setMessage(null);
      const parsed = canPay ? dollarsToCents(rate) : null;
      if (parsed === "invalid") {
        setMessage("Type the rate as dollars, for example 28.50.");
        return;
      }
      const result = await addPosition({
        venueId,
        key,
        name,
        defaultRateCents: parsed ?? 0,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setKey(crypto.randomUUID());
      setName("");
      setRate("");
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Positions</Heading>
        {positions.length === 0 ? (
          <Text type="supporting" color="secondary">
            No positions yet. Add the jobs people do here, such as Bar or
            Kitchen.
          </Text>
        ) : (
          positions.map((p) => (
            <Text key={p.id} type="body">
              {p.name}
              {p.rateLabel ? ` · ${p.rateLabel}` : ""}
            </Text>
          ))
        )}
        {message ? <Banner status="error" title={message} /> : null}
        <HStack gap={2} wrap="wrap" vAlign="end">
          <TextInput label="New position" value={name} onChange={setName} />
          {canPay ? (
            <TextInput
              label="Default rate per hour ($)"
              inputMode="decimal"
              value={rate}
              onChange={setRate}
              isOptional
            />
          ) : null}
          <Button
            label="Add position"
            variant="primary"
            isLoading={pending}
            isDisabled={name.trim() === ""}
            onClick={submit}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
