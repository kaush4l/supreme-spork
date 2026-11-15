"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideClaim, decideRequest, type Outcome } from "./actions";

export type RequestView = {
  id: string;
  kind: "leave" | "swap";
  title: string;
  reason: string | null;
};
export type OfferView = {
  id: string;
  title: string;
  context: string;
  claims: { id: string; name: string; decision: string | null }[];
};

const RESULT_WORDS: Record<Outcome["result"], string> = {
  approved: "Approved",
  rejected: "Declined",
  already_decided: "Already decided",
};

type Decide = (
  approve: boolean,
  note: string,
  key: string,
) => Promise<
  { ok: true; data: Outcome } | { ok: false; error: { message: string } }
>;

/**
 * One approve/decline pair with an optional note. The key is made when drawn and replaced only after a success, so a
 * double tap or a retry sends the same one. A decided row shows its result in place of the buttons.
 */
function DecisionRow({
  venueId,
  approveLabel,
  rejectLabel,
  decide,
}: {
  venueId: string;
  approveLabel: string;
  rejectLabel: string;
  decide: Decide;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const go = (approve: boolean) =>
    start(async () => {
      setMessage(null);
      const result = await decide(approve, note, key);
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setKey(crypto.randomUUID());
      setOutcome(result.data);
      router.refresh();
    });

  if (outcome)
    return (
      <VStack gap={2} hAlign="start">
        <Text type="body">{RESULT_WORDS[outcome.result]}</Text>
        {outcome.needsPublish ? (
          <Link href={`/venues/${venueId}/roster`}>
            Publish the roster to tell them
          </Link>
        ) : null}
      </VStack>
    );

  return (
    <VStack gap={2} hAlign="stretch">
      <TextInput
        label="Note (optional)"
        value={note}
        onChange={setNote}
        isOptional
        isDisabled={pending}
      />
      {message ? <Banner status="error" title={message} /> : null}
      <HStack gap={2}>
        <Button
          label={approveLabel}
          variant="primary"
          isLoading={pending}
          onClick={() => go(true)}
        />
        <Button
          label={rejectLabel}
          isLoading={pending}
          onClick={() => go(false)}
        />
      </HStack>
    </VStack>
  );
}

export function ApprovalsInbox({
  venueId,
  requests,
  offers,
}: {
  venueId: string;
  requests: RequestView[];
  offers: OfferView[];
}) {
  return (
    <VStack gap={4} hAlign="stretch">
      {requests.length > 0 ? (
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Leave and swap requests</Heading>
          {requests.map((r) => (
            <Card key={r.id} padding={4}>
              <VStack gap={3} hAlign="stretch">
                <Text type="body">{r.title}</Text>
                {r.reason ? (
                  <Text type="supporting" color="secondary">
                    Reason: {r.reason}
                  </Text>
                ) : null}
                <DecisionRow
                  venueId={venueId}
                  approveLabel="Approve"
                  rejectLabel="Decline"
                  decide={(approve, note, key) =>
                    decideRequest({
                      venueId,
                      requestId: r.id,
                      approve,
                      note,
                      key,
                    })
                  }
                />
              </VStack>
            </Card>
          ))}
        </VStack>
      ) : null}
      {offers.length > 0 ? (
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Shift pool</Heading>
          {offers.map((o) => (
            <Card key={o.id} padding={4}>
              <VStack gap={3} hAlign="stretch">
                <Text type="body">{o.title}</Text>
                <Text type="supporting" color="secondary">
                  {o.context}
                </Text>
                {o.claims.length === 0 ? (
                  <Text type="supporting" color="secondary">
                    Nobody has asked for it yet.
                  </Text>
                ) : (
                  o.claims.map((c) => (
                    <VStack key={c.id} gap={2} hAlign="stretch">
                      <Text type="body">{c.name} asked for this shift</Text>
                      {c.decision ? (
                        <Text type="supporting" color="secondary">
                          {c.decision === "approved" ? "Approved" : "Declined"}
                        </Text>
                      ) : (
                        <DecisionRow
                          venueId={venueId}
                          approveLabel={`Give to ${c.name}`}
                          rejectLabel="Not this time"
                          decide={(approve, note, key) =>
                            decideClaim({
                              venueId,
                              offerId: o.id,
                              claimId: c.id,
                              approve,
                              note,
                              key,
                            })
                          }
                        />
                      )}
                    </VStack>
                  ))
                )}
              </VStack>
            </Card>
          ))}
        </VStack>
      ) : null}
    </VStack>
  );
}
