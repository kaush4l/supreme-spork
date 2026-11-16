"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { setAside } from "./actions";

/** "Set aside" on one exception: a reason is required, and a quick second click writes nothing more. */
export function SetAside({
  venueId,
  exceptionKey,
}: {
  venueId: string;
  exceptionKey: string;
}) {
  const router = useRouter();
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (!open)
    return (
      <Button
        label="Set aside"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      />
    );

  const submit = () =>
    start(
      guard(async () => {
        if (!reason.trim()) return setMessage("Say why this is set aside.");
        setMessage(null);
        const result = await setAside({
          venueId,
          idemKey,
          key: exceptionKey,
          reason,
        });
        if (!result.ok) return setMessage(result.error.message);
        setIdemKey(crypto.randomUUID());
        setOpen(false);
        setReason("");
        router.refresh();
      }),
    );

  return (
    <VStack gap={2} hAlign="stretch">
      <TextInput
        label="Why is this set aside?"
        value={reason}
        onChange={setReason}
        isRequired
      />
      {message ? <Banner status="error" title={message} /> : null}
      <HStack gap={2}>
        <Button
          label="Save and set aside"
          variant="primary"
          isLoading={pending}
          onClick={submit}
        />
        <Button label="Cancel" variant="ghost" onClick={() => setOpen(false)} />
      </HStack>
    </VStack>
  );
}
