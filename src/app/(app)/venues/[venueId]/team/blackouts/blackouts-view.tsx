"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { addBlackout, removeBlackout } from "./actions";

export type BlackoutLine = {
  id: string;
  start: string;
  end: string;
  reason: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function BlackoutsView({
  venueId,
  items,
}: {
  venueId: string;
  items: BlackoutLine[];
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState<BlackoutLine | null>(null);

  const add = guard(async () => {
    setMessage(null);
    if (!DAY.test(start) || !DAY.test(end))
      return setMessage("Write the dates like 2026-12-24.");
    setPending(true);
    const result = await addBlackout({
      venueId,
      key,
      startDate: start,
      endDate: end,
      reason,
    });
    setPending(false);
    if (!result.ok) return setMessage(result.error.message);
    setKey(crypto.randomUUID());
    setStart("");
    setEnd("");
    setReason("");
    router.refresh();
  });

  const remove = guard(async () => {
    if (!asking) return;
    setMessage(null);
    setPending(true);
    const result = await removeBlackout({ venueId, blackoutId: asking.id });
    setPending(false);
    setAsking(null);
    if (!result.ok) return setMessage(result.error.message);
    router.refresh();
  });

  return (
    <VStack gap={4} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {items.length === 0 ? (
        <Text type="supporting" color="secondary">
          No blackout dates. Staff can ask for leave on any day.
        </Text>
      ) : (
        items.map((b) => (
          <Card key={b.id} padding={4}>
            <VStack gap={2} hAlign="stretch">
              <Text type="body">
                {b.start === b.end ? b.start : `${b.start} to ${b.end}`}
              </Text>
              <Text type="supporting" color="secondary">
                {b.reason}
              </Text>
              <HStack gap={2}>
                <Button
                  label="Remove"
                  variant="destructive"
                  onClick={() => setAsking(b)}
                />
              </HStack>
            </VStack>
          </Card>
        ))
      )}
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Add blackout dates</Heading>
          <TextInput
            label="First day"
            value={start}
            onChange={setStart}
            placeholder="2026-12-24"
          />
          <TextInput
            label="Last day"
            value={end}
            onChange={setEnd}
            placeholder="2026-12-26"
          />
          <TextInput
            label="Reason (staff see this)"
            value={reason}
            onChange={setReason}
          />
          <Button
            label="Add blackout"
            variant="primary"
            isLoading={pending}
            isDisabled={reason.trim() === ""}
            onClick={add}
          />
        </VStack>
      </Card>
      <AlertDialog
        isOpen={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title="Remove these dates?"
        description={
          asking
            ? `${asking.start} to ${asking.end}: ${asking.reason}. Staff will be able to ask for leave on these days again.`
            : ""
        }
        actionLabel="Remove"
        actionVariant="destructive"
        isActionLoading={pending}
        onAction={remove}
      />
    </VStack>
  );
}
