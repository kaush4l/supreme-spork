"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyStarter } from "./actions";

export function StarterCard({
  venueId,
  starterKey,
  name,
  description,
  count,
}: {
  venueId: string;
  starterKey: string;
  name: string;
  description: string | null;
  count: number;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = () =>
    start(async () => {
      const result = await copyStarter({ venueId, starterKey, key });
      if (!result.ok) return setMessage(result.error.message);
      setMessage(null);
      setCopied(true);
      setKey(crypto.randomUUID());
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="start">
        <Text type="body">
          {name} ({count} items)
        </Text>
        {description ? (
          <Text type="supporting" color="secondary">
            {description}
          </Text>
        ) : null}
        {message ? <Banner status="error" title={message} /> : null}
        {copied ? (
          <Banner status="success" title="Copied to your checklists." />
        ) : null}
        <Button
          label="Copy to my checklists"
          isLoading={pending}
          onClick={copy}
        />
      </VStack>
    </Card>
  );
}
