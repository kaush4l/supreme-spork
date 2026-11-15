"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isDay } from "./dates";

export function RangeForm({
  venueId,
  from,
  to,
  status,
}: {
  venueId: string;
  from: string;
  to: string;
  status: "due" | "all";
}) {
  const router = useRouter();
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const [s, setS] = useState<string>(status);
  const [message, setMessage] = useState<string | null>(null);

  const show = () => {
    if (!isDay(a) || !isDay(b))
      return setMessage("Write both dates like 2026-11-16.");
    if (b < a) return setMessage("The end date is before the start date.");
    setMessage(null);
    router.push(`/venues/${venueId}/bills?from=${a}&to=${b}&status=${s}`);
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
          placeholder="2026-12-31"
        />
      </HStack>
      <Selector
        label="Show"
        value={s}
        options={[
          { value: "due", label: "Still to pay" },
          { value: "all", label: "All, including paid" },
        ]}
        onChange={setS}
      />
      {message ? <Banner status="error" title={message} /> : null}
      <HStack gap={2}>
        <Button label="Show" variant="primary" onClick={show} />
      </HStack>
    </VStack>
  );
}
