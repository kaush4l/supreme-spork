"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { decideClaim, withdrawOffer } from "./actions";

export type ClaimLine = {
  id: string;
  name: string;
  decision: string | null;
  note: string | null;
  whenLabel: string;
};

export type OfferLine = {
  id: string;
  title: string;
  when: string;
  kindLabel: string;
  modeLabel: string;
  statusLabel: string;
  open: boolean;
  shiftCancelled: boolean;
  claims: ClaimLine[];
};

const DECISION_WORDS: Record<string, string> = {
  approved: "Got the shift",
  rejected: "Not this time",
};

/** One offer: who asked for it, a button to give it or turn it down, and a way to take the offer back. */
export function OfferCard({
  venueId,
  offer,
}: {
  venueId: string;
  offer: OfferLine;
}) {
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const decide = (claimId: string, approve: boolean) =>
    guard(async () => {
      setBusy(`${claimId}:${approve}`);
      setMessage(null);
      setNotice(null);
      const r = await decideClaim({
        venueId,
        key,
        offerId: offer.id,
        claimId,
        approve,
      });
      setBusy(null);
      if (!r.ok) return setMessage(r.error.message);
      setKey(crypto.randomUUID());
      if (r.data.approved)
        setNotice(
          r.data.needsPublish
            ? "The shift is theirs. Publish the week so they see it."
            : "The shift is theirs and the week was republished.",
        );
    });

  const withdraw = guard(async () => {
    setBusy("withdraw");
    setMessage(null);
    const r = await withdrawOffer({ venueId, key, offerId: offer.id });
    setBusy(null);
    if (!r.ok) return setMessage(r.error.message);
    setKey(crypto.randomUUID());
  });

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <HStack gap={2} wrap="wrap">
          <Text type="body">{offer.title}</Text>
          <Badge label={offer.statusLabel} variant="neutral" />
        </HStack>
        <Text type="supporting" color="secondary">
          {offer.when}
        </Text>
        <Text type="supporting" color="secondary">
          {offer.kindLabel} · {offer.modeLabel}
        </Text>
        {offer.shiftCancelled ? (
          <Text type="supporting" color="secondary">
            This shift was cancelled, so nobody can take it.
          </Text>
        ) : null}
        {offer.claims.length === 0 ? (
          <Text type="supporting" color="secondary">
            Nobody has asked for it yet.
          </Text>
        ) : (
          offer.claims.map((c) => (
            <VStack key={c.id} gap={1} hAlign="stretch">
              <Text type="body">
                {c.name} asked ({c.whenLabel})
                {c.decision
                  ? `: ${DECISION_WORDS[c.decision] ?? c.decision}`
                  : ""}
              </Text>
              {offer.open && !c.decision ? (
                <HStack gap={2} wrap="wrap">
                  <Button
                    label={`Give it to ${c.name}`}
                    variant="primary"
                    size="sm"
                    isLoading={busy === `${c.id}:true`}
                    isDisabled={busy !== null}
                    onClick={decide(c.id, true)}
                  />
                  <Button
                    label="Not this time"
                    size="sm"
                    isLoading={busy === `${c.id}:false`}
                    isDisabled={busy !== null}
                    onClick={decide(c.id, false)}
                  />
                </HStack>
              ) : null}
            </VStack>
          ))
        )}
        {message ? <Banner status="error" title={message} /> : null}
        {notice ? <Banner status="success" title={notice} /> : null}
        {offer.open ? (
          <HStack>
            <Button
              label="Withdraw offer"
              size="sm"
              isLoading={busy === "withdraw"}
              isDisabled={busy !== null}
              onClick={withdraw}
            />
          </HStack>
        ) : null}
      </VStack>
    </Card>
  );
}
