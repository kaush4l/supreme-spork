"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { approveSalesFile, rejectSalesFile, reparseSalesFile } from "./actions";

/** Approve, reject (a reason is required) or read again. Approve and reject only show while the file waits for a person. */
export function ReviewButtons({
  venueId,
  documentId,
  waiting,
}: {
  venueId: string;
  documentId: string;
  waiting: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = (
    send: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await send();
        if (!result.ok)
          return setMessage(result.error?.message ?? "That did not work.");
        setKey(crypto.randomUUID());
        setRejecting(false);
        setReason("");
        router.refresh();
      }),
    );
  const ids = { venueId, documentId, key };

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {rejecting ? (
        <VStack gap={2} hAlign="stretch">
          <TextInput
            label="Why is this file rejected?"
            value={reason}
            onChange={setReason}
            size="lg"
          />
          <HStack gap={2}>
            <Button
              label="Reject file"
              isLoading={pending}
              isDisabled={reason.trim() === ""}
              onClick={() => run(() => rejectSalesFile({ ...ids, reason }))}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onClick={() => setRejecting(false)}
            />
          </HStack>
        </VStack>
      ) : (
        <HStack gap={2} wrap="wrap">
          {waiting ? (
            <Button
              label="Approve"
              variant="primary"
              size="lg"
              isLoading={pending}
              onClick={() => run(() => approveSalesFile(ids))}
            />
          ) : null}
          {waiting ? (
            <Button
              label="Reject"
              size="lg"
              onClick={() => setRejecting(true)}
            />
          ) : null}
          <Button
            label="Read again"
            variant="ghost"
            size="lg"
            isLoading={pending}
            onClick={() => run(() => reparseSalesFile(ids))}
          />
        </HStack>
      )}
    </VStack>
  );
}
