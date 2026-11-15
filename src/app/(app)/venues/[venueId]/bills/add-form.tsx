"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dollarsToCents } from "@/server/data/money-input";
import { addBill } from "./actions";
import { isDay } from "./dates";
import { useGuard } from "./guarded";
import { CADENCE_OPTIONS, KIND_OPTIONS } from "./words";

/** Add a bill the owner knows about. A bill of the same kind and payee is refused by the API; its words are shown as sent. */
export function AddBillForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("other");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [cadence, setCadence] = useState("monthly");
  const [nextDue, setNextDue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () =>
    start(
      guard(async () => {
        setMessage(null);
        setNotice(null);
        const cents = dollarsToCents(amount);
        if (cents === null || cents === "invalid" || cents <= 0)
          return setMessage("Type the amount as dollars, for example 650.00.");
        if (!isDay(nextDue))
          return setMessage("Write the next due date like 2026-12-01.");
        const result = await addBill({
          venueId,
          key,
          label,
          kind: kind as "other",
          counterparty: payee,
          amountCents: cents,
          cadence: cadence as "monthly",
          nextDue,
        });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        setNotice(`Added ${label}.`);
        setLabel("");
        setPayee("");
        setAmount("");
        setNextDue("");
        router.refresh();
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
      <Selector
        label="Kind"
        value={kind}
        options={KIND_OPTIONS}
        onChange={setKind}
      />
      <TextInput
        label="Who is paid"
        description="As the bank prints it, for example direct debit landlord."
        value={payee}
        onChange={setPayee}
        isOptional
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
        placeholder="2026-12-01"
        size="lg"
      />
      <Button
        label="Add bill"
        variant="primary"
        size="lg"
        isLoading={pending}
        isDisabled={
          label.trim() === "" || amount.trim() === "" || nextDue.trim() === ""
        }
        onClick={submit}
      />
    </VStack>
  );
}
