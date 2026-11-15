"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelInvite } from "./actions";

export type InviteLine = {
  id: string;
  email: string;
  roleLabel: string;
  status: string;
  statusLabel: string;
};

/** Invites sent and not yet answered; a waiting one can be cancelled. */
export function InvitesCard({
  venueId,
  invites,
}: {
  venueId: string;
  invites: InviteLine[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const cancel = (inviteId: string) =>
    start(async () => {
      setMessage(null);
      const result = await cancelInvite({ venueId, inviteId });
      if (!result.ok) setMessage(result.error.message);
      else router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Invites</Heading>
        {message ? <Banner status="error" title={message} /> : null}
        {invites.length === 0 ? (
          <Text type="supporting" color="secondary">
            No invites waiting.
          </Text>
        ) : (
          invites.map((i) => (
            <HStack key={i.id} gap={2} wrap="wrap">
              <Text type="body">
                {i.email} · {i.roleLabel}
              </Text>
              <Badge
                label={i.statusLabel}
                variant={i.status === "open" ? "info" : "neutral"}
              />
              {i.status === "open" ? (
                <Button
                  label="Cancel invite"
                  isDisabled={pending}
                  onClick={() => cancel(i.id)}
                />
              ) : null}
            </HStack>
          ))
        )}
      </VStack>
    </Card>
  );
}
