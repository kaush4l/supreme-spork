"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dollarsToCents } from "@/server/data/money-input";
import { useGuard } from "../../bills/guarded";
import { isDay } from "../../timesheet/range";
import { recordPayment } from "../actions";
import { isKind, KIND_OPTIONS } from "../words";

type Option = { value: string; label: string };

/** One quick form: the kind first, then only the fields that kind needs. The API's own sentences are shown for a refusal. */
export function PaymentForm({
  venueId,
  people,
  suppliers,
  bills,
}: {
  venueId: string;
  people: Option[];
  suppliers: Option[];
  /** Open bill dates: `value` is `billId|dueOn`. Empty when the person cannot read bills. */
  bills: Option[];
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [kind, setKind] = useState("wages");
  const [amount, setAmount] = useState("");
  const [person, setPerson] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [supplier, setSupplier] = useState("");
  const [bill, setBill] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = () =>
    start(
      guard(async () => {
        setMessage(null);
        if (!isKind(kind)) return setMessage("Choose what kind of payment.");
        const cents = dollarsToCents(amount);
        if (cents === null || cents === "invalid" || cents <= 0)
          return setMessage("Type the amount as dollars, for example 45.50.");
        if (kind === "wages" && person === "")
          return setMessage("Choose who was paid.");
        if (kind === "supplier" && supplier === "")
          return setMessage("Choose the supplier who was paid.");
        if (kind === "petty" && note.trim() === "")
          return setMessage("Say what the petty cash was for.");
        if (paidOn !== "" && !isDay(paidOn))
          return setMessage(
            "Write the day like 2026-11-16, or leave it empty.",
          );
        if (kind === "wages" && (periodFrom !== "" || periodTo !== "")) {
          if (!isDay(periodFrom) || !isDay(periodTo))
            return setMessage(
              "Write both ends of the pay period like 2026-11-09, or leave both empty.",
            );
        }
        const [billId, billDueOn] = bill.split("|");
        const result = await recordPayment({
          venueId,
          key,
          kind,
          amountCents: cents,
          ...(paidOn ? { paidOn } : {}),
          ...(kind === "wages" ? { staffRef: person } : {}),
          ...(kind === "wages" && periodFrom ? { periodFrom, periodTo } : {}),
          ...(kind === "supplier" ? { supplierId: supplier } : {}),
          ...(kind === "supplier" && billId ? { billId, billDueOn } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        router.push(`/venues/${venueId}/cash-book`);
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      <Selector
        label="What kind of payment?"
        value={kind}
        options={KIND_OPTIONS}
        onChange={setKind}
      />
      <TextInput
        label="Amount ($)"
        inputMode="decimal"
        value={amount}
        onChange={setAmount}
        size="lg"
      />
      {kind === "wages" ? (
        <>
          <Selector
            label="Who was paid?"
            value={person}
            options={people}
            onChange={setPerson}
            placeholder="Choose a person"
            hasSearch={people.length > 8}
          />
          <HStack gap={2}>
            <TextInput
              label="Pay period from"
              value={periodFrom}
              onChange={setPeriodFrom}
              placeholder="2026-11-09"
              isOptional
            />
            <TextInput
              label="Pay period to"
              value={periodTo}
              onChange={setPeriodTo}
              placeholder="2026-11-15"
              isOptional
            />
          </HStack>
        </>
      ) : null}
      {kind === "supplier" ? (
        <>
          <Selector
            label="Which supplier was paid?"
            value={supplier}
            options={suppliers}
            onChange={setSupplier}
            placeholder="Choose a supplier"
            hasSearch={suppliers.length > 8}
          />
          {bills.length > 0 ? (
            <Selector
              label="Does this pay a bill?"
              description="That bill date is marked paid in cash."
              value={bill}
              options={bills}
              onChange={(v) => setBill(v ?? "")}
              placeholder="No bill"
              hasClear
              hasSearch={bills.length > 8}
            />
          ) : null}
        </>
      ) : null}
      <TextInput
        label={kind === "petty" ? "What was it for?" : "Note"}
        value={note}
        onChange={setNote}
        isOptional={kind !== "petty"}
        size="lg"
      />
      <TextInput
        label="Paid on (if not today)"
        value={paidOn}
        onChange={setPaidOn}
        placeholder="2026-11-16"
        isOptional
      />
      <Button
        label="Save payment"
        variant="primary"
        size="lg"
        isLoading={pending}
        isDisabled={amount.trim() === ""}
        onClick={submit}
      />
    </VStack>
  );
}
