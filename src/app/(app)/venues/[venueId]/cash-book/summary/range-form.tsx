"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isDay } from "../../timesheet/range";

export function RangeForm({
  venueId,
  from,
  to,
}: {
  venueId: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const [message, setMessage] = useState<string | null>(null);

  const show = () => {
    if (!isDay(a) || !isDay(b))
      return setMessage("Write both dates like 2026-11-16.");
    if (b < a) return setMessage("The end date is before the start date.");
    setMessage(null);
    router.push(`/venues/${venueId}/cash-book/summary?from=${a}&to=${b}`);
  };

  return (
    <VStack gap={2} hAlign="stretch">
      <HStack gap={2}>
        <TextInput
          label="From"
          value={a}
          onChange={setA}
          placeholder="2026-11-09"
        />
        <TextInput
          label="To"
          value={b}
          onChange={setB}
          placeholder="2026-11-15"
        />
      </HStack>
      {message ? <Banner status="error" title={message} /> : null}
      <HStack gap={2}>
        <Button label="Show" variant="primary" onClick={show} />
      </HStack>
    </VStack>
  );
}
