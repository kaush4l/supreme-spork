"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markRead } from "./actions";

export function MarkReadButton({
  venueId,
  id,
}: {
  venueId: string;
  id: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <VStack gap={2} hAlign="start">
      {message ? <Banner status="error" title={message} /> : null}
      <Button
        label="Mark read"
        isLoading={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const result = await markRead({ venueId, id });
            if (!result.ok) {
              setMessage(result.error.message || "That did not work.");
              return;
            }
            router.refresh();
          })
        }
      />
    </VStack>
  );
}
