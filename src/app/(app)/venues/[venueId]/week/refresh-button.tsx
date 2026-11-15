"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshDay } from "./actions";

export function RefreshButton({
  venueId,
  day,
}: {
  venueId: string;
  day: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = () => {
    if (pending) return;
    start(async () => {
      setMessage(null);
      setDone(false);
      const result = await refreshDay({ venueId, day, key });
      if (!result.ok) {
        setMessage(result.error?.message ?? "That did not work.");
        return;
      }
      setKey(crypto.randomUUID());
      setDone(true);
      router.refresh();
    });
  };

  return (
    <VStack gap={2} hAlign="start">
      <Button label="Refresh this day" isLoading={pending} onClick={run} />
      {message ? <Banner status="error" title={message} /> : null}
      {done ? (
        <Banner status="success" title="This day is up to date." />
      ) : null}
    </VStack>
  );
}
