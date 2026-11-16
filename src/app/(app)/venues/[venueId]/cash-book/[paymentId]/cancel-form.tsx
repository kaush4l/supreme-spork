"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { cancelPayment } from "../actions";

/** Cancel a payment with a reason. The API's `bill_note` (a paid bill stays paid) is shown after the cancel. */
export function CancelForm({
  venueId,
  paymentId,
  canCancel,
}: {
  venueId: string;
  paymentId: string;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [billNote, setBillNote] = useState<string | null>(null);

  const submit = () =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await cancelPayment({
          venueId,
          paymentId,
          key,
          reason,
        });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        setBillNote(result.data.billNote);
        router.refresh();
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {billNote ? <Banner status="info" title={billNote} /> : null}
      {canCancel ? (
        <>
          {message ? <Banner status="error" title={message} /> : null}
          <TextInput
            label="Why is this payment cancelled?"
            value={reason}
            onChange={setReason}
            size="lg"
          />
          <Button
            label="Cancel this payment"
            variant="primary"
            size="lg"
            isLoading={pending}
            isDisabled={reason.trim() === ""}
            onClick={submit}
          />
        </>
      ) : null}
    </VStack>
  );
}
