"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptInvite, declineInvite } from "../actions";

type Invite = { id: string; venue_name: string | null; role: string };

/** The invitations waiting for this person. Joining is their choice: nothing happens until they press Accept. */
export function Invites({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const answer = (act: typeof acceptInvite, id: string) =>
    start(async () => {
      const result = await act({ id });
      if (!result.ok) setMessage(result.error.message);
      else {
        setMessage(null);
        router.refresh();
      }
    });

  if (invites.length === 0) return null;
  return (
    <VStack gap={2} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {invites.map((invite) => (
        <HStack key={invite.id} gap={3} vAlign="center">
          <Text type="body">
            {invite.venue_name ?? "A venue"} invited you as {invite.role}.
          </Text>
          <Button
            label="Accept"
            variant="primary"
            isDisabled={pending}
            onClick={() => answer(acceptInvite, invite.id)}
          />
          <Button
            label="Decline"
            variant="secondary"
            isDisabled={pending}
            onClick={() => answer(declineInvite, invite.id)}
          />
        </HStack>
      ))}
    </VStack>
  );
}
