"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../guarded";
import { linkDocket, unlinkDocket } from "./actions";

export function DocketLinks({
  venueId,
  billId,
  dueOn,
  dockets,
}: {
  venueId: string;
  billId: string;
  dueOn: string;
  dockets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [docketId, setDocketId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const link = () =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await linkDocket({
          venueId,
          billId,
          key,
          documentId: docketId.trim(),
          dueOn,
        });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        setDocketId("");
        router.refresh();
      }),
    );

  const unlink = (id: string) =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await unlinkDocket({
          venueId,
          billId,
          key: crypto.randomUUID(),
          documentId: id,
        });
        if (!result.ok) return setMessage(result.error.message);
        router.refresh();
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {dockets.length === 0 ? (
        <Text type="supporting" color="secondary">
          No dockets are linked to this bill.
        </Text>
      ) : null}
      {dockets.map((d) => (
        <HStack key={d.id} gap={2} vAlign="center">
          <Text type="body">{d.name}</Text>
          <Button
            label="Unlink"
            variant="ghost"
            isLoading={pending}
            onClick={() => unlink(d.id)}
          />
        </HStack>
      ))}
      <TextInput
        label="Docket reference"
        description="The docket's id, to link it to this due date."
        value={docketId}
        onChange={setDocketId}
        size="lg"
      />
      <Button
        label="Link docket"
        isLoading={pending}
        isDisabled={docketId.trim() === ""}
        onClick={link}
      />
    </VStack>
  );
}
