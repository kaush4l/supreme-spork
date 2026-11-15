"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DateInput } from "@astryxdesign/core/DateInput";
import { VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { askLeave, askSwap } from "./actions";
import type { IsoDay } from "./words";

/** Ask for leave. The key is replaced only after a success, so a double tap sends one request. */
export function LeaveForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [from, setFrom] = useState<IsoDay | undefined>();
  const [to, setTo] = useState<IsoDay | undefined>();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = () =>
    start(async () => {
      setMessage(null);
      setSent(false);
      if (!from) {
        setMessage("Choose the first day.");
        return;
      }
      const result = await askLeave({
        venueId,
        key,
        startDate: from,
        endDate: to ?? from,
        reason,
      });
      if (!result.ok) {
        setMessage(result.error.message || "That did not work.");
        return;
      }
      setKey(crypto.randomUUID());
      setFrom(undefined);
      setTo(undefined);
      setReason("");
      setSent(true);
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Ask for leave</Heading>
        <DateInput label="First day" value={from} onChange={setFrom} />
        <DateInput
          label="Last day"
          description="Leave empty for one day."
          isOptional
          hasClear
          value={to}
          onChange={setTo}
        />
        <TextArea
          label="Reason"
          isOptional
          maxLength={300}
          value={reason}
          onChange={(v) => setReason(v)}
        />
        {message ? <Banner status="error" title={message} /> : null}
        {sent ? (
          <Banner status="success" title="Sent. Your manager will reply." />
        ) : null}
        <Button
          label="Send request"
          variant="primary"
          size="lg"
          isLoading={pending}
          onClick={submit}
        />
      </VStack>
    </Card>
  );
}

export type SwapShiftOption = { value: string; label: string };
export type ColleagueOption = { value: string; label: string };

/** Ask a colleague to take one of my shifts that has not started. */
export function SwapForm({
  venueId,
  shifts,
  colleagues,
}: {
  venueId: string;
  shifts: SwapShiftOption[];
  colleagues: ColleagueOption[];
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [shiftId, setShiftId] = useState<string | undefined>();
  const [colleagueId, setColleagueId] = useState<string | undefined>();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = () =>
    start(async () => {
      setMessage(null);
      setSent(false);
      if (!shiftId || !colleagueId) {
        setMessage("Choose a shift and a colleague.");
        return;
      }
      const result = await askSwap({
        venueId,
        key,
        shiftId,
        colleagueId,
        reason,
      });
      if (!result.ok) {
        setMessage(result.error.message || "That did not work.");
        return;
      }
      setKey(crypto.randomUUID());
      setShiftId(undefined);
      setColleagueId(undefined);
      setReason("");
      setSent(true);
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Ask a colleague to take a shift</Heading>
        <Selector
          label="Your shift"
          placeholder="Choose a shift"
          options={shifts}
          value={shiftId}
          onChange={setShiftId}
        />
        <Selector
          label="Colleague"
          placeholder="Choose a colleague"
          options={colleagues}
          value={colleagueId}
          onChange={setColleagueId}
          hasSearch
        />
        <TextArea
          label="Reason"
          isOptional
          maxLength={300}
          value={reason}
          onChange={(v) => setReason(v)}
        />
        {message ? <Banner status="error" title={message} /> : null}
        {sent ? (
          <Banner status="success" title="Sent. Your manager will decide." />
        ) : null}
        <Button
          label="Send request"
          variant="primary"
          size="lg"
          isLoading={pending}
          onClick={submit}
        />
      </VStack>
    </Card>
  );
}
