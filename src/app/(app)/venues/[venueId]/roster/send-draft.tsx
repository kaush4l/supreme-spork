"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../bills/guarded";
import { sendDraft } from "./drafts/actions";

const DEFAULT = "default";
const HOURS = [
  { value: DEFAULT, label: "The venue's usual time" },
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
  { value: "72", label: "72 hours" },
];

/** Send the week to the team as a draft to reply to. The backend freezes the venue's rules for it and tells people. */
export function SendDraft({
  venueId,
  week,
}: {
  venueId: string;
  week: string;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [hours, setHours] = useState(DEFAULT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [alreadyOut, setAlreadyOut] = useState(false);

  const send = guard(async () => {
    setBusy(true);
    setMessage(null);
    setAlreadyOut(false);
    const r = await sendDraft({
      venueId,
      key,
      week,
      replyHours: hours === DEFAULT ? null : Number(hours),
    });
    if (!r.ok) {
      setBusy(false);
      setAlreadyOut(r.error.code === "draft_open");
      return setMessage(r.error.message);
    }
    setKey(crypto.randomUUID());
    router.push(`/venues/${venueId}/roster/drafts/${r.data.draftId}`);
  });

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <Heading level={2}>Send as a draft</Heading>
        <Text type="supporting" color="secondary">
          People see this week as a draft and can accept, decline or suggest
          another time before you publish it.
        </Text>
        {message ? (
          <Banner
            status="error"
            title={message}
            description={
              alreadyOut ? (
                <Link href={`/venues/${venueId}/roster/drafts`}>
                  See the drafts
                </Link>
              ) : undefined
            }
          />
        ) : null}
        <HStack gap={2} wrap="wrap" vAlign="end">
          <Selector
            label="Time to reply"
            value={hours}
            options={HOURS}
            onChange={setHours}
          />
          <Button
            label="Send as draft"
            variant="secondary"
            isLoading={busy}
            onClick={send}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
