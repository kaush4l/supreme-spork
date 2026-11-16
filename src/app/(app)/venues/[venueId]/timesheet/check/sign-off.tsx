"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { markChecked } from "./actions";

/** "Mark this period checked", with an optional note. */
export function SignOff({
  venueId,
  from,
  to,
  openCount,
}: {
  venueId: string;
  from: string;
  to: string;
  openCount: number;
}) {
  const router = useRouter();
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () =>
    start(
      guard(async () => {
        setDone(false);
        setMessage(null);
        const result = await markChecked({
          venueId,
          idemKey,
          from,
          to,
          note,
        });
        if (!result.ok) return setMessage(result.error.message);
        setIdemKey(crypto.randomUUID());
        setNote("");
        setDone(true);
        router.refresh();
      }),
    );

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Mark this period checked</Heading>
        <Text type="supporting" color="secondary">
          {from} to {to}.{" "}
          {openCount > 0
            ? `${openCount} still open will be written down with the check.`
            : "Nothing is open."}
        </Text>
        <TextInput label="Note (optional)" value={note} onChange={setNote} />
        {message ? <Banner status="error" title={message} /> : null}
        {done ? <Banner status="success" title="Marked as checked." /> : null}
        <Button
          label="Mark checked"
          variant="primary"
          isLoading={pending}
          onClick={submit}
        />
      </VStack>
    </Card>
  );
}
