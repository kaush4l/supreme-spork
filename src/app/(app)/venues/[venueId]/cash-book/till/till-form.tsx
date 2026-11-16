"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dollarsToCents } from "@/server/data/money-input";
import { useGuard } from "../../bills/guarded";
import { isDay } from "../../timesheet/range";
import { recordTillCount } from "../actions";

/** Count the till for a day. A day left empty is today's; counting a day again replaces that day's count. */
export function TillForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [day, setDay] = useState("");
  const [counted, setCounted] = useState("");
  const [float, setFloat] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () =>
    start(
      guard(async () => {
        setMessage(null);
        setNotice(null);
        const countedCents = dollarsToCents(counted);
        if (countedCents === null || countedCents === "invalid")
          return setMessage(
            "Type what you counted as dollars, for example 480.50.",
          );
        const floatCents = dollarsToCents(float);
        if (floatCents === "invalid")
          return setMessage("Type the float as dollars, for example 200.00.");
        if (day !== "" && !isDay(day))
          return setMessage(
            "Write the day like 2026-11-16, or leave it empty.",
          );
        const result = await recordTillCount({
          venueId,
          key,
          ...(day ? { tradingDay: day } : {}),
          countedCents,
          floatCents: floatCents ?? 0,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        if (!result.ok) return setMessage(result.error.message);
        setKey(crypto.randomUUID());
        setNotice(`Saved. ${result.data.flagLabel}`);
        setCounted("");
        setFloat("");
        setNote("");
        router.refresh();
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {notice ? <Banner status="success" title={notice} /> : null}
      <TextInput
        label="Day counted (if not today)"
        value={day}
        onChange={setDay}
        placeholder="2026-11-16"
        isOptional
      />
      <TextInput
        label="Counted in the till ($)"
        inputMode="decimal"
        value={counted}
        onChange={setCounted}
        size="lg"
      />
      <TextInput
        label="Float left in the till to start the day ($)"
        inputMode="decimal"
        value={float}
        onChange={setFloat}
        isOptional
        size="lg"
      />
      <TextInput
        label="Note"
        value={note}
        onChange={setNote}
        isOptional
        size="lg"
      />
      <Button
        label="Save count"
        variant="primary"
        size="lg"
        isLoading={pending}
        isDisabled={counted.trim() === ""}
        onClick={submit}
      />
    </VStack>
  );
}
