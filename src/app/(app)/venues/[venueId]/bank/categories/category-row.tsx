"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { changeCategory } from "./actions";

export function CategoryRow({
  venueId,
  name,
  label,
  active,
  isProtected,
  inUse,
}: {
  venueId: string;
  name: string;
  label: string;
  active: boolean;
  isProtected: boolean;
  inUse: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [text, setText] = useState(label);
  const [message, setMessage] = useState<string | null>(null);

  const send = (change: { label?: string; active?: boolean }) =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await changeCategory({
          venueId,
          key: crypto.randomUUID(),
          name,
          ...change,
        });
        if (!result.ok) return setMessage(result.error.message);
        router.refresh();
      }),
    );

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <Text type="body">
          {label}
          {active ? "" : " (switched off)"}
        </Text>
        <Text type="supporting" color="secondary">
          {inUse} bank rows filed here{isProtected ? ", built in" : ""}
        </Text>
        {message ? <Banner status="error" title={message} /> : null}
        <TextInput
          label="Name shown"
          value={text}
          onChange={setText}
          size="lg"
        />
        <HStack gap={2} wrap="wrap">
          <Button
            label="Save name"
            isLoading={pending}
            isDisabled={text.trim() === "" || text.trim() === label}
            onClick={() => send({ label: text.trim() })}
          />
          <Button
            label={active ? "Switch off" : "Switch on"}
            variant="ghost"
            isLoading={pending}
            isDisabled={active && isProtected}
            onClick={() => send({ active: !active })}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
