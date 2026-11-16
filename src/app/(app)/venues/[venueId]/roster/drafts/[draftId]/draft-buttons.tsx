"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { useState } from "react";
import { useGuard } from "../../../bills/guarded";
import { cancelDraft, decideReply, publishDraft } from "../actions";

/** Agree to or turn down one reply that needs the manager's word. */
export function ReplyButtons({
  venueId,
  draftId,
  replyId,
  yesLabel,
}: {
  venueId: string;
  draftId: string;
  replyId: string;
  yesLabel: string;
}) {
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const decide = (approve: boolean) =>
    guard(async () => {
      setBusy(approve);
      setMessage(null);
      const r = await decideReply({ venueId, draftId, replyId, key, approve });
      setBusy(null);
      if (!r.ok) return setMessage(r.error.message);
      setKey(crypto.randomUUID());
    });

  return (
    <VStack gap={1} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      <HStack gap={2} wrap="wrap">
        <Button
          label={yesLabel}
          variant="primary"
          size="sm"
          isLoading={busy === true}
          isDisabled={busy !== null}
          onClick={decide(true)}
        />
        <Button
          label="Not this time"
          size="sm"
          isLoading={busy === false}
          isDisabled={busy !== null}
          onClick={decide(false)}
        />
      </HStack>
    </VStack>
  );
}

/** Publish the draft's week or cancel the draft. Publishing is only shown to someone who holds the publish right. */
export function DraftActions({
  venueId,
  draftId,
  canPublish,
}: {
  venueId: string;
  draftId: string;
  canPublish: boolean;
}) {
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<"publish" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    title: string;
    approval: boolean;
  } | null>(null);

  const publish = guard(async () => {
    setBusy("publish");
    setMessage(null);
    setNotice(null);
    const r = await publishDraft({ venueId, draftId, key });
    setBusy(null);
    if (!r.ok) return setMessage(r.error.message);
    setKey(crypto.randomUUID());
    setNotice(
      r.data.needsApproval
        ? { title: "Sent for approval", approval: true }
        : {
            title: r.data.version
              ? `Published as version ${r.data.version}.`
              : "Published.",
            approval: false,
          },
    );
  });

  const cancel = guard(async () => {
    setBusy("cancel");
    setMessage(null);
    const r = await cancelDraft({ venueId, draftId, key });
    setBusy(null);
    if (!r.ok) return setMessage(r.error.message);
    setKey(crypto.randomUUID());
  });

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        {message ? <Banner status="error" title={message} /> : null}
        {notice ? (
          <Banner
            status={notice.approval ? "info" : "success"}
            title={notice.title}
            description={
              notice.approval ? (
                <Link href={`/venues/${venueId}/changes`}>
                  See change requests
                </Link>
              ) : undefined
            }
          />
        ) : null}
        <HStack gap={2} wrap="wrap">
          {canPublish ? (
            <Button
              label="Publish this week"
              variant="primary"
              isLoading={busy === "publish"}
              isDisabled={busy !== null}
              onClick={publish}
            />
          ) : null}
          {confirmCancel ? (
            <Button
              label="Yes, cancel this draft"
              variant="destructive"
              isLoading={busy === "cancel"}
              isDisabled={busy !== null}
              onClick={cancel}
            />
          ) : (
            <Button
              label="Cancel draft"
              isDisabled={busy !== null}
              onClick={() => setConfirmCancel(true)}
            />
          )}
        </HStack>
        {confirmCancel ? (
          <Text type="supporting" color="secondary">
            The draft is taken back. The shifts stay as they are.
          </Text>
        ) : null}
      </VStack>
    </Card>
  );
}
