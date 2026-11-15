"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimOffer, dropShift, withdrawClaim, withdrawOffer } from "./actions";

type Kind = "drop" | "claim" | "withdraw" | "withdrawClaim";

const LABEL: Record<Kind, string> = {
  drop: "Can't work it",
  claim: "Claim this shift",
  withdraw: "Take it back",
  withdrawClaim: "Take back my request",
};

/**
 * One button for one write. A key is made when it is drawn and replaced only after a success, so a double tap or a
 * retry on a poor connection does it once.
 */
export function ShiftButton({
  kind,
  venueId,
  id,
}: {
  kind: Kind;
  venueId: string;
  id: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onClick = () =>
    start(async () => {
      setMessage(null);
      setNotice(null);
      const input = { venueId, id, key };
      const result =
        kind === "drop"
          ? await dropShift(input)
          : kind === "claim"
            ? await claimOffer(input)
            : kind === "withdrawClaim"
              ? await withdrawClaim(input)
              : await withdrawOffer(input);
      if (!result.ok) {
        setMessage(result.error.message || "That did not work.");
        return;
      }
      if (kind === "withdrawClaim") setNotice("Your request is taken back.");
      if (kind === "drop")
        setNotice("Put in the pool. It stays yours until someone is given it.");
      setKey(crypto.randomUUID());
      router.refresh();
    });

  return (
    <VStack gap={2} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {notice ? <Banner status="success" title={notice} /> : null}
      <Button
        label={LABEL[kind]}
        variant={kind === "claim" ? "primary" : "secondary"}
        size="lg"
        isLoading={pending}
        onClick={onClick}
      />
    </VStack>
  );
}
