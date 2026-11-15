"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { issueNow } from "./actions";
import { type Made, madeWords } from "./made";

export function IssueNow({ venueId, week }: { venueId: string; week: string }) {
  const router = useRouter();
  const guard = useGuard();
  const [pending, start] = useTransition();
  const [day, setDay] = useState(week);
  const [made, setMade] = useState<Made | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const issue = guard(async () => {
    setMessage(null);
    setMade(null);
    await new Promise<void>((resolve) =>
      start(async () => {
        const result = await issueNow({ venueId, week: day.trim() });
        if (result.ok) {
          setMade(result.data);
          router.refresh();
        } else setMessage(result.error.message);
        resolve();
      }),
    );
  });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Issue lists now</Heading>
        <Text type="supporting" color="secondary">
          This gives out the lists your rules ask for to every filled shift of
          one published roster week. Lists already given out are not made again,
          so pressing it twice adds nothing. Publishing a roster does this on
          its own.
        </Text>
        <TextInput
          label="Week starting (a Monday)"
          value={day}
          onChange={setDay}
          placeholder="2026-11-09"
        />
        {message ? <Banner status="error" title={message} /> : null}
        {made ? <Banner status="success" title={madeWords(made)} /> : null}
        <Button
          label="Issue lists now"
          variant="primary"
          isLoading={pending}
          onClick={issue}
        />
      </VStack>
    </Card>
  );
}
