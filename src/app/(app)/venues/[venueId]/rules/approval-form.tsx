"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setApproval } from "../changes/actions";

export type ApprovalLine = {
  key: string;
  label: string;
  help: string;
  approval: string;
};

const LEVEL_WORDS: Record<string, string> = {
  off: "No approval",
  owner: "Owner approves",
  partner: "Partner approves",
};

/** One switch row per right that can need approval; each change is saved at once with its own key. */
export function ApprovalForm({
  venueId,
  lines,
  levels,
  limitLabel,
  canEdit,
}: {
  venueId: string;
  lines: ApprovalLine[];
  levels: string[];
  limitLabel: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const change = (capability: string, approval: string) =>
    start(async () => {
      setMessage(null);
      const result = await setApproval({
        venueId,
        key: crypto.randomUUID(),
        capability,
        approval: approval as "off" | "owner" | "partner",
      });
      if (!result.ok) setMessage(result.error.message);
      else router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={4} hAlign="stretch">
        <VStack gap={1}>
          <Heading level={2}>What needs approval</Heading>
          <Text type="supporting" color="secondary">
            Choose who must approve these changes before they happen. The
            request waits in Change requests.
          </Text>
          <Text type="supporting" color="secondary">
            {limitLabel}
          </Text>
        </VStack>
        {message ? <Banner status="error" title={message} /> : null}
        {!canEdit ? (
          <Banner status="info" title="Only the owner can change these." />
        ) : null}
        {lines.map((line) => (
          <VStack key={line.key} gap={1} hAlign="stretch">
            <Text type="body">{line.label}</Text>
            <Text type="supporting" color="secondary">
              {line.help}
            </Text>
            <SegmentedControl
              label={line.label}
              value={line.approval}
              isDisabled={!canEdit || pending}
              onChange={(v: string) => change(line.key, v)}
            >
              {levels.map((level) => (
                <SegmentedControlItem
                  key={level}
                  value={level}
                  label={LEVEL_WORDS[level] ?? level}
                />
              ))}
            </SegmentedControl>
          </VStack>
        ))}
      </VStack>
    </Card>
  );
}
