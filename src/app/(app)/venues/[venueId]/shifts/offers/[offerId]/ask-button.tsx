"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimOffer } from "../../actions";

/**
 * "Ask for this shift": the same write as the claim button on My shifts (`claimOffer`). A key is made when it is
 * drawn and replaced only after a success, so a double tap does it once. When someone else got there first (409
 * already_taken) the backend's sentence is shown and the page is read again, so the person sees who won in the same
 * moment.
 */
export function AskButton({
  venueId,
  offerId,
}: {
  venueId: string;
  offerId: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <VStack gap={2} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      <Button
        label="Ask for this shift"
        variant="primary"
        size="lg"
        isLoading={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const result = await claimOffer({ venueId, id: offerId, key });
            if (!result.ok) {
              setMessage(result.error.message || "That did not work.");
              router.refresh();
              return;
            }
            setKey(crypto.randomUUID());
            router.refresh();
          })
        }
      />
    </VStack>
  );
}
