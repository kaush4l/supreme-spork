"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { DateTimeInput } from "@astryxdesign/core/DateTimeInput";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { useState, useTransition } from "react";
import { addShift, cancelShift, changeShift } from "./actions";
import type { PersonOption, ShiftView } from "./types";

const OPEN = "open";

/**
 * Add a shift (`shift` null) or edit one. Times are typed in the venue's own time; they are sent with no zone and the
 * backend reads them as venue time. Whether the person may work it is the backend's answer, shown as it comes.
 */
export function ShiftDialog({
  venueId,
  shift,
  startDate,
  positions,
  people,
  onClose,
}: {
  venueId: string;
  shift: ShiftView | null;
  /** `YYYY-MM-DD` the new shift starts on by default. */
  startDate: string;
  positions: string[];
  people: PersonOption[];
  onClose: () => void;
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, run] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [position, setPosition] = useState(shift?.position ?? "");
  const [who, setWho] = useState(shift?.staffId ?? OPEN);
  const [start, setStart] = useState(shift?.startInput ?? `${startDate}T09:00`);
  const [end, setEnd] = useState(shift?.endInput ?? `${startDate}T17:00`);
  const [breakMinutes, setBreakMinutes] = useState(shift?.breakMinutes ?? 0);

  const done = (result: { ok: boolean; error?: { message: string } }) => {
    if (!result.ok) {
      setMessage(result.error?.message ?? "That did not work.");
      return;
    }
    setKey(crypto.randomUUID());
    onClose();
  };

  const save = () =>
    run(async () => {
      setMessage(null);
      if (!position) {
        setMessage("Choose a position.");
        return;
      }
      const staffId = who === OPEN ? null : who;
      if (!shift) {
        done(
          await addShift({
            venueId,
            key,
            position,
            staffId,
            start,
            end,
            breakMinutes,
          }),
        );
        return;
      }
      done(
        await changeShift({
          venueId,
          key,
          externalId: shift.id,
          position: position !== shift.position ? position : undefined,
          staffId: staffId !== shift.staffId ? staffId : undefined,
          start: start !== shift.startInput ? start : undefined,
          end: end !== shift.endInput ? end : undefined,
          breakMinutes:
            breakMinutes !== shift.breakMinutes ? breakMinutes : undefined,
        }),
      );
    });

  const cancel = () =>
    run(async () => {
      if (!shift) return;
      setMessage(null);
      done(await cancelShift({ venueId, key, externalId: shift.id }));
    });

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} purpose="form">
      <DialogHeader
        title={shift ? "Edit shift" : "Add a shift"}
        onOpenChange={(open) => !open && onClose()}
      />
      <VStack gap={3} hAlign="stretch">
        {message ? <Banner status="error" title={message} /> : null}
        <Selector
          label="Position"
          value={position || undefined}
          options={positions}
          onChange={setPosition}
          placeholder="Choose a position"
        />
        <Selector
          label="Who works it"
          value={who}
          options={[
            { value: OPEN, label: "Open (nobody yet)" },
            ...people.map((p) => ({ value: p.id, label: p.name })),
          ]}
          onChange={setWho}
          hasSearch={people.length > 8}
        />
        {people.length === 0 ? (
          <Text type="supporting" color="secondary">
            The list of people is not available to you, so shifts can only be
            left open.
          </Text>
        ) : null}
        <DateTimeInput
          label="Starts (venue time)"
          value={start as never}
          onChange={(v) => v && setStart(v)}
        />
        <DateTimeInput
          label="Ends (venue time)"
          value={end as never}
          onChange={(v) => v && setEnd(v)}
        />
        <NumberInput
          label="Break (minutes)"
          value={breakMinutes}
          min={0}
          max={240}
          onChange={setBreakMinutes}
        />
        <HStack gap={2} justify="end">
          {shift ? (
            confirmCancel ? (
              <Button
                label="Yes, cancel this shift"
                variant="destructive"
                isLoading={pending}
                onClick={cancel}
              />
            ) : (
              <Button
                label="Cancel shift"
                variant="secondary"
                onClick={() => setConfirmCancel(true)}
              />
            )
          ) : null}
          <Button label="Close" variant="secondary" onClick={onClose} />
          <Button
            label={shift ? "Save" : "Add shift"}
            variant="primary"
            isLoading={pending}
            onClick={save}
          />
        </HStack>
      </VStack>
    </Dialog>
  );
}
