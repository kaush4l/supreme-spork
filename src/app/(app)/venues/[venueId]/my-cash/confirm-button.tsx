"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../bills/guarded";
import { confirmCash } from "./actions";

/** "I got this cash". The key is made when the button is drawn and the click is guarded, so a double click confirms once. */
export function ConfirmButton({
  venueId,
  paymentId,
}: {
  venueId: string;
  paymentId: string;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const confirm = guard(async () => {
    setBusy(true);
    setMessage(null);
    const result = await confirmCash({ venueId, paymentId, key });
    if (!result.ok) {
      setBusy(false);
      setMessage(result.error.message);
      // already confirmed elsewhere: show the page as it now is
      if (result.error.code === "already_confirmed") router.refresh();
      return;
    }
    router.refresh();
  });

  return (
    <VStack gap={2} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      <Button
        label="I got this cash"
        variant="primary"
        size="lg"
        isLoading={busy}
        onClick={confirm}
      />
    </VStack>
  );
}
