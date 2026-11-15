"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { makeCalendarLink, revokeCalendarLink } from "./actions";

/**
 * The link can be read only when it is made: the backend keeps just a hash. So the address is held in this page's
 * memory until the person leaves it, and a new one is the only way to see a link again.
 */
export function CalendarLink({
  hasLink,
  sinceLabel,
}: {
  hasLink: boolean;
  sinceLabel: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const [address, setAddress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState<"make" | "revoke" | null>(null);

  const guarded = (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        await fn();
      } finally {
        busy.current = false;
      }
    });
  };

  const make = () =>
    guarded(async () => {
      setMessage(null);
      setNotice(null);
      setAsking(null);
      const result = await makeCalendarLink({});
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setAddress(result.data.address);
      router.refresh();
    });

  const revoke = () =>
    guarded(async () => {
      setMessage(null);
      setNotice(null);
      setAsking(null);
      const result = await revokeCalendarLink({});
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setAddress(null);
      setNotice("Link turned off. The old link no longer works.");
      router.refresh();
    });

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setNotice("Copied.");
    } catch {
      setNotice("Could not copy. Select the link and copy it by hand.");
    }
  };

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {notice ? <Banner status="success" title={notice} /> : null}
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Your link</Heading>
          <Text type="body">
            {hasLink
              ? `You have a calendar link${sinceLabel ? `, made on ${sinceLabel}` : ""}.`
              : "You do not have a calendar link."}
          </Text>
          {address ? (
            <VStack gap={2} hAlign="stretch">
              <Banner
                status="warning"
                title="Copy it now. It is shown only this once."
                description="We keep only a scrambled copy, so we cannot show it again. If you lose it, make a new link. Anyone with the link can see your shifts, so keep it private."
              />
              <TextInput
                label="Calendar link"
                value={address}
                onChange={() => {}}
                isReadOnly
                size="lg"
              />
              <Button label="Copy link" size="lg" onClick={copy} />
            </VStack>
          ) : hasLink ? (
            <Text type="supporting" color="secondary">
              The link cannot be shown again. If you lost it, make a new one;
              that turns the old one off.
            </Text>
          ) : null}
          <Button
            label={hasLink ? "Make a new link" : "Make my link"}
            variant="primary"
            size="lg"
            isLoading={pending}
            onClick={() => (hasLink ? setAsking("make") : make())}
          />
          {hasLink ? (
            <Button
              label="Turn the link off"
              variant="destructive"
              isDisabled={pending}
              onClick={() => setAsking("revoke")}
            />
          ) : null}
        </VStack>
      </Card>
      <AlertDialog
        isOpen={asking === "make"}
        onOpenChange={(open) => !open && setAsking(null)}
        title="Make a new link?"
        description="Your old link stops working at once. Add the new one to your calendar app."
        actionLabel="Make a new link"
        isActionLoading={pending}
        onAction={make}
      />
      <AlertDialog
        isOpen={asking === "revoke"}
        onOpenChange={(open) => !open && setAsking(null)}
        title="Turn the link off?"
        description="The link stops working at once. Calendars using it stop updating. You can make a new link later."
        actionLabel="Turn off"
        actionVariant="destructive"
        isActionLoading={pending}
        onAction={revoke}
      />
    </VStack>
  );
}
