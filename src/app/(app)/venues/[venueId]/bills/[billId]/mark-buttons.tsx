"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../guarded";
import { markDue } from "./actions";

/** Mark this due date paid or not due, or open it again. `state` is the API's word for where it stands now. */
export function MarkButtons({
  venueId,
  billId,
  dueOn,
  state,
}: {
  venueId: string;
  billId: string;
  dueOn: string;
  state: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const mark = (status: "paid" | "not_due" | "open") =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await markDue({
          venueId,
          billId,
          key,
          dueOn,
          status,
          note: note.trim() || undefined,
        });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        setNote("");
        router.refresh();
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      <TextInput
        label="Note"
        value={note}
        onChange={setNote}
        isOptional
        size="lg"
      />
      <HStack gap={2} wrap="wrap">
        {state !== "paid" ? (
          <Button
            label="Mark paid"
            variant="primary"
            size="lg"
            isLoading={pending}
            onClick={() => mark("paid")}
          />
        ) : null}
        {state !== "not_due" ? (
          <Button
            label="Mark not due"
            size="lg"
            isLoading={pending}
            onClick={() => mark("not_due")}
          />
        ) : null}
        {state !== "due" ? (
          <Button
            label="Open again"
            size="lg"
            isLoading={pending}
            onClick={() => mark("open")}
          />
        ) : null}
      </HStack>
    </VStack>
  );
}
