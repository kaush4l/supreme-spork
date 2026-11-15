"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addEntry } from "./actions";
import { isDay } from "./range";

/** Add a missed clock-in or clock-out. Time is venue-local; the note is required. */
export function EntryForm({
  venueId,
  staff,
}: {
  venueId: string;
  staff: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [staffId, setStaffId] = useState("");
  const [kind, setKind] = useState("in");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [brk, setBrk] = useState("0");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () =>
    start(async () => {
      setDone(false);
      if (!staffId) return setMessage("Choose the person.");
      if (!isDay(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        return setMessage(
          "Write the date like 2026-11-16 and the time like 17:30.",
        );
      if (!note.trim()) return setMessage("Say why you are adding this.");
      const minutes = Number(brk);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240)
        return setMessage("Break must be 0 to 240 minutes.");
      const result = await addEntry({
        venueId,
        key,
        staffId,
        kind: kind === "out" ? "out" : "in",
        at: `${day}T${time}`,
        breakMinutes: minutes,
        note,
      });
      if (!result.ok) return setMessage(result.error.message);
      setMessage(null);
      setDone(true);
      setKey(crypto.randomUUID());
      setNote("");
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Add a missing entry</Heading>
        <Selector
          label="Person"
          options={staff}
          value={staffId}
          onChange={setStaffId}
          hasSearch
        />
        <Selector
          label="Clock"
          options={[
            { value: "in", label: "Clock in" },
            { value: "out", label: "Clock out" },
          ]}
          value={kind}
          onChange={setKind}
        />
        <TextInput
          label="Date"
          value={day}
          onChange={setDay}
          placeholder="2026-11-16"
        />
        <TextInput
          label="Time"
          value={time}
          onChange={setTime}
          placeholder="17:30"
        />
        {kind === "out" ? (
          <TextInput
            label="Break (minutes)"
            value={brk}
            onChange={setBrk}
            inputMode="numeric"
          />
        ) : null}
        <TextInput
          label="Why are you adding this?"
          value={note}
          onChange={setNote}
          isRequired
        />
        {message ? <Banner status="error" title={message} /> : null}
        {done ? <Banner status="success" title="Entry added." /> : null}
        <Button
          label="Add entry"
          variant="primary"
          isLoading={pending}
          onClick={submit}
        />
      </VStack>
    </Card>
  );
}
