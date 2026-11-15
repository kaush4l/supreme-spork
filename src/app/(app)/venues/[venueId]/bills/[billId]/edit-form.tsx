"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dollarsToCents } from "@/server/data/money-input";
import { isDay } from "../dates";
import { useGuard } from "../guarded";
import { CADENCE_OPTIONS } from "../words";
import { editBill } from "./actions";

/** Change a bill. Only the boxes that differ from what is saved are sent. "Take off the list" retires it. */
export function EditBillForm(props: {
  venueId: string;
  billId: string;
  label: string;
  amount: string;
  cadence: string;
  nextDue: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [label, setLabel] = useState(props.label);
  const [amount, setAmount] = useState(props.amount);
  const [cadence, setCadence] = useState(props.cadence);
  const [nextDue, setNextDue] = useState(props.nextDue);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const done = (r: {
    billId: string;
    nextDue: string | null;
    retired: boolean;
  }) => {
    setKey(crypto.randomUUID());
    if (r.retired) return router.push(`/venues/${props.venueId}/bills`);
    setNotice("Saved.");
    router.replace(`/venues/${props.venueId}/bills/${r.billId}`);
  };

  const save = () =>
    start(
      guard(async () => {
        setMessage(null);
        setNotice(null);
        const change: {
          label?: string;
          amountCents?: number;
          cadence?: "weekly";
          nextDue?: string;
        } = {};
        if (label.trim() !== props.label) change.label = label;
        if (amount.trim() !== props.amount) {
          const cents = dollarsToCents(amount);
          if (cents === null || cents === "invalid" || cents <= 0)
            return setMessage(
              "Type the amount as dollars, for example 650.00.",
            );
          change.amountCents = cents;
        }
        if (cadence !== props.cadence) change.cadence = cadence as "weekly";
        if (nextDue.trim() !== props.nextDue) {
          if (!isDay(nextDue.trim()))
            return setMessage("Write the date like 2026-12-01.");
          change.nextDue = nextDue.trim();
        }
        if (Object.keys(change).length === 0)
          return setMessage("Nothing is changed yet.");
        const result = await editBill({
          venueId: props.venueId,
          billId: props.billId,
          key,
          ...change,
        });
        if (!result.ok) return setMessage(result.error.message);
        done(result.data);
      }),
    );

  const retire = () =>
    start(
      guard(async () => {
        setMessage(null);
        const result = await editBill({
          venueId: props.venueId,
          billId: props.billId,
          key,
          retire: true,
        });
        if (!result.ok) return setMessage(result.error.message);
        done(result.data);
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {notice ? <Banner status="success" title={notice} /> : null}
      <TextInput
        label="Bill name"
        value={label}
        onChange={setLabel}
        size="lg"
      />
      <TextInput
        label="Amount ($)"
        inputMode="decimal"
        value={amount}
        onChange={setAmount}
        size="lg"
      />
      <Selector
        label="How often"
        value={cadence}
        options={CADENCE_OPTIONS}
        onChange={setCadence}
      />
      <TextInput
        label="Next due date"
        value={nextDue}
        onChange={setNextDue}
        size="lg"
      />
      <Button
        label="Save changes"
        variant="primary"
        size="lg"
        isLoading={pending}
        onClick={save}
      />
      {confirm ? (
        <HStack gap={2}>
          <Button
            label="Yes, take it off the list"
            isLoading={pending}
            onClick={retire}
          />
          <Button
            label="Keep it"
            variant="ghost"
            onClick={() => setConfirm(false)}
          />
        </HStack>
      ) : (
        <Button
          label="Take off the list"
          variant="ghost"
          onClick={() => setConfirm(true)}
        />
      )}
    </VStack>
  );
}
