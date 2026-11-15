"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { correctEntry } from "./actions";
import { isWallTime, wallTime } from "./wall";

/** Correct one line: its clock-in time, clock-out time and/or break. Times are venue-local; the note is required. */
export function CorrectForm({
  venueId,
  clockInId,
  clockOutId,
  clockIn,
  clockOut,
  breakMinutes,
  timeZone,
}: {
  venueId: string;
  clockInId: string | null;
  clockOutId: string | null;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  timeZone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const startIn = wallTime(clockIn, timeZone);
  const startOut = clockOut ? wallTime(clockOut, timeZone) : "";
  const [inAt, setInAt] = useState(startIn);
  const [outAt, setOutAt] = useState(startOut);
  const [brk, setBrk] = useState(String(breakMinutes));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!clockInId && !clockOutId) return null;
  if (!open)
    return (
      <Button
        label="Correct"
        variant="secondary"
        size="sm"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
      />
    );

  const submit = () =>
    start(async () => {
      setDone(false);
      if (!note.trim()) return setMessage("Say why you are correcting this.");
      if (!isWallTime(inAt) || (clockOutId && outAt && !isWallTime(outAt)))
        return setMessage(
          "Write the times like 2026-11-16T17:30 (date, T, time).",
        );
      const minutes = Number(brk);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240)
        return setMessage("Break must be 0 to 240 minutes.");
      const newIn = clockInId && inAt !== startIn ? inAt : undefined;
      const newOut =
        clockOutId && outAt && outAt !== startOut ? outAt : undefined;
      const newBrk =
        clockOutId && minutes !== breakMinutes ? minutes : undefined;
      if (!newIn && !newOut && newBrk === undefined)
        return setMessage("Change a time or the break first.");
      // one call per entry corrected
      if (newIn && clockInId) {
        const r = await correctEntry({
          venueId,
          entryId: clockInId,
          at: newIn,
          note,
        });
        if (!r.ok) return setMessage(r.error.message);
      }
      if ((newOut || newBrk !== undefined) && clockOutId) {
        const r = await correctEntry({
          venueId,
          entryId: clockOutId,
          at: newOut,
          breakMinutes: newBrk,
          note,
        });
        if (!r.ok)
          return setMessage(
            newIn
              ? `The clock-in was changed, but the clock-out was not: ${r.error.message}`
              : r.error.message,
          );
      }
      setMessage(null);
      setDone(true);
      setOpen(false);
      setNote("");
      router.refresh();
    });

  return (
    <VStack gap={2} hAlign="stretch">
      <TextInput
        label="Clock in (venue time)"
        value={inAt}
        onChange={setInAt}
        placeholder="2026-11-16T09:00"
        isDisabled={!clockInId}
      />
      {clockOutId ? (
        <>
          <TextInput
            label="Clock out (venue time)"
            value={outAt}
            onChange={setOutAt}
            placeholder="2026-11-16T17:30"
          />
          <TextInput
            label="Break (minutes)"
            value={brk}
            onChange={setBrk}
            inputMode="numeric"
          />
        </>
      ) : null}
      <TextInput
        label="Why are you correcting this?"
        value={note}
        onChange={setNote}
        isRequired
      />
      {message ? <Banner status="error" title={message} /> : null}
      {done ? <Banner status="success" title="Corrected." /> : null}
      <Button
        label="Save correction"
        variant="primary"
        isLoading={pending}
        onClick={submit}
      />
      <Button
        label="Cancel"
        variant="secondary"
        onClick={() => setOpen(false)}
      />
    </VStack>
  );
}
