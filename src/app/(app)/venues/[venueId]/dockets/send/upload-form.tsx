"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { useState, useTransition } from "react";
import { type SentDocket, sendDocket } from "./upload";

/** Take a photo of a docket, or choose a photo or PDF. Says plainly whether it was new or already held. */
export function UploadForm({
  venueId,
  canOpen,
}: {
  venueId: string;
  canOpen: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState<SentDocket | null>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      setMessage(null);
      setSent(null);
      try {
        setSent(await sendDocket(venueId, file));
      } catch (error) {
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : "The docket did not upload. Please try again.",
        );
      }
    });
  };

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <label>
          <Text type="label">
            {pending ? "Sending..." : "Take a photo of the docket"}
          </Text>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={pending}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <label>
          <Text type="label">Or choose a photo or a PDF</Text>
          <input
            type="file"
            accept="image/*,application/pdf"
            disabled={pending}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {message ? <Banner status="error" title={message} /> : null}
        {sent ? (
          <Banner
            status={sent.created ? "success" : "info"}
            title={
              sent.created
                ? "Sent. This is a new docket and it will be read."
                : "We already had this docket, so nothing new was added."
            }
          />
        ) : null}
        {sent && canOpen ? (
          <Link href={`/venues/${venueId}/dockets/${sent.documentId}`}>
            Open this docket
          </Link>
        ) : null}
      </VStack>
    </Card>
  );
}
