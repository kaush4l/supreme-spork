"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addMyItem } from "./actions";

const KINDS = ["tick", "number", "note", "photo"] as const;
const KIND_WORDS: Record<(typeof KINDS)[number], string> = {
  tick: "Tick",
  number: "Number",
  note: "Note",
  photo: "Photo",
};

/** Add my own item to this list only. One key per attempt, replaced after it worked. */
export function AddItem({
  venueId,
  listId,
}: {
  venueId: string;
  listId: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("tick");
  const [message, setMessage] = useState<string | null>(null);

  const onAdd = () =>
    start(async () => {
      setMessage(null);
      const result = await addMyItem({ venueId, listId, key, label, kind });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setKey(crypto.randomUUID());
      setLabel("");
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Add my own item</Heading>
        <TextInput
          label="What needs doing?"
          value={label}
          onChange={(v) => setLabel(v)}
        />
        <SegmentedControl
          label="How will you answer it?"
          value={kind}
          onChange={(v) => setKind(v as (typeof KINDS)[number])}
        >
          {KINDS.map((k) => (
            <SegmentedControlItem key={k} value={k} label={KIND_WORDS[k]} />
          ))}
        </SegmentedControl>
        {message ? <Banner status="error" title={message} /> : null}
        <Button
          label="Add item"
          isLoading={pending}
          isDisabled={label.trim() === ""}
          onClick={onAdd}
        />
      </VStack>
    </Card>
  );
}
