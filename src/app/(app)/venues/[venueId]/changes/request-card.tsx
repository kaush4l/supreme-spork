"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveRequest, rejectRequest, withdrawRequest } from "./actions";

export type RequestLine = {
  id: string;
  actionLabel: string;
  summary: string;
  who: string;
  whenLabel: string;
  status: string;
  statusLabel: string;
  mine: boolean;
  note: string | null;
};

/** One request in plain words, with the buttons that fit: approve or reject someone else's, withdraw your own. */
export function RequestCard({
  venueId,
  request,
}: {
  venueId: string;
  request: RequestLine;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const waiting = request.status === "pending";

  const run = (
    send: () => Promise<{
      ok: boolean;
      data?: { statusLabel: string | null };
      error?: { message: string };
    }>,
  ) =>
    start(async () => {
      setMessage(null);
      setNotice(null);
      const result = await send();
      if (!result.ok) {
        setMessage(result.error?.message ?? "That did not work.");
        return;
      }
      setKey(crypto.randomUUID());
      if (result.data?.statusLabel) setNotice(result.data.statusLabel);
      router.refresh();
    });

  const ids = { venueId, requestId: request.id, key };
  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <HStack gap={2} wrap="wrap">
          <Text type="body">{request.actionLabel}</Text>
          <Badge
            label={request.statusLabel}
            variant={
              waiting
                ? "warning"
                : request.status === "applied" || request.status === "approved"
                  ? "success"
                  : "neutral"
            }
          />
        </HStack>
        <Text type="body">{request.summary}</Text>
        <Text type="supporting" color="secondary">
          Asked by {request.who} · {request.whenLabel}
          {request.note ? ` · Note: ${request.note}` : ""}
        </Text>
        {message ? <Banner status="error" title={message} /> : null}
        {notice ? <Banner status="info" title={notice} /> : null}
        {waiting ? (
          <HStack gap={2} wrap="wrap">
            {request.mine ? (
              <Button
                label="Withdraw"
                isLoading={pending}
                onClick={() => run(() => withdrawRequest(ids))}
              />
            ) : (
              <>
                <Button
                  label="Approve"
                  variant="primary"
                  isLoading={pending}
                  onClick={() => run(() => approveRequest(ids))}
                />
                <Button
                  label="Reject"
                  isDisabled={pending}
                  onClick={() => run(() => rejectRequest(ids))}
                />
              </>
            )}
          </HStack>
        ) : null}
      </VStack>
    </Card>
  );
}
