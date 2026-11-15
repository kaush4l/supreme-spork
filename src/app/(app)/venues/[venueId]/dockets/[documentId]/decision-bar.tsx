"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveDocket, rejectDocket } from "./actions";

/** Approve a flagged docket, or set it aside with a reason. The reason is required. */
export function DecisionBar({
  venueId,
  documentId,
}: {
  venueId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [approveKey, setApproveKey] = useState(() => crypto.randomUUID());
  const [rejectKey, setRejectKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const approve = () =>
    start(async () => {
      setMessage(null);
      const result = await approveDocket({
        venueId,
        documentId,
        key: approveKey,
      });
      if (!result.ok) return setMessage(result.error.message);
      setApproveKey(crypto.randomUUID());
      router.refresh();
    });

  const reject = () =>
    start(async () => {
      setMessage(null);
      if (!reason.trim()) return setMessage("Say why you are rejecting this.");
      const result = await rejectDocket({
        venueId,
        documentId,
        key: rejectKey,
        reason,
      });
      if (!result.ok) return setMessage(result.error.message);
      setRejectKey(crypto.randomUUID());
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        {message ? <Banner status="error" title={message} /> : null}
        {rejecting ? (
          <>
            <TextInput
              label="Why are you rejecting this docket?"
              value={reason}
              onChange={setReason}
              isRequired
            />
            <HStack gap={2} wrap="wrap">
              <Button
                label="Reject docket"
                variant="destructive"
                isLoading={pending}
                onClick={reject}
              />
              <Button
                label="Cancel"
                isDisabled={pending}
                onClick={() => setRejecting(false)}
              />
            </HStack>
          </>
        ) : (
          <HStack gap={2} wrap="wrap">
            <Button
              label="Approve"
              variant="primary"
              isLoading={pending}
              onClick={approve}
            />
            <Button
              label="Reject"
              isDisabled={pending}
              onClick={() => setRejecting(true)}
            />
          </HStack>
        )}
      </VStack>
    </Card>
  );
}
