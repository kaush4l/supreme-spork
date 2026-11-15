"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AvailabilityRow } from "@/server/data/team-extras";
import { useGuard } from "../../bills/guarded";
import { addAvailability, removeAvailability } from "./actions";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
type Entry =
  | {
      kind: "weekly";
      weekday: number;
      fromTime: string;
      toTime: string;
      available: boolean;
      note?: string;
    }
  | {
      kind: "once";
      startDate: string;
      endDate: string;
      available: boolean;
      note?: string;
    };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const hm = (t?: string | null) => (t ?? "").slice(0, 5);

function describe(r: AvailabilityRow): string {
  const what = r.available ? "Can work" : "Cannot work";
  const when =
    r.kind === "weekly"
      ? `${WEEKDAYS[r.weekday ?? 0] ?? ""} ${hm(r.from_time)} to ${hm(r.to_time)}`
      : r.start_date === r.end_date || !r.end_date
        ? `${r.start_date}`
        : `${r.start_date} to ${r.end_date}`;
  return `${what} · ${when}${r.note ? ` · ${r.note}` : ""}`;
}

export function AvailabilityCard({
  venueId,
  staffId,
  owner,
  rows,
}: {
  venueId: string;
  staffId: string;
  owner: string;
  rows: AvailabilityRow[];
}) {
  const router = useRouter();
  const guard = useGuard();
  const theirs = owner === "person";
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState("weekly");
  const [weekday, setWeekday] = useState("0");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [available, setAvailable] = useState("no");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const add = guard(async () => {
    setMessage(null);
    const can = available === "yes";
    let entry: Entry;
    if (kind === "weekly") {
      if (!TIME.test(from) || !TIME.test(to))
        return setMessage("Write the times like 09:00 and 17:30.");
      entry = {
        kind: "weekly",
        weekday: Number(weekday),
        fromTime: from,
        toTime: to,
        available: can,
        note,
      };
    } else {
      if (!DAY.test(first) || !DAY.test(last || first))
        return setMessage("Write the dates like 2026-12-24.");
      entry = {
        kind: "once",
        startDate: first,
        endDate: last || first,
        available: can,
        note,
      };
    }
    setPending(true);
    const result = await addAvailability({ venueId, staffId, key, entry });
    setPending(false);
    if (!result.ok) return setMessage(result.error.message);
    setKey(crypto.randomUUID());
    setNote("");
    router.refresh();
  });

  const remove = guard(async (rowId: string) => {
    setMessage(null);
    setPending(true);
    const result = await removeAvailability({ venueId, staffId, rowId });
    setPending(false);
    if (!result.ok) return setMessage(result.error.message);
    router.refresh();
  });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Availability</Heading>
        <Text type="supporting" color="secondary">
          {theirs
            ? "These are their own entries. They sign in and manage them themselves."
            : "They have not signed in yet, so you can enter this for them."}
        </Text>
        {rows.length === 0 ? (
          <Text type="supporting" color="secondary">
            No availability entries.
          </Text>
        ) : (
          rows.map((r) => (
            <HStack key={r.id} gap={2} wrap="wrap">
              <Text type="body">{describe(r)}</Text>
              {theirs ? null : (
                <Button
                  label="Remove"
                  aria-label={`Remove entry: ${describe(r)}`}
                  isDisabled={pending}
                  onClick={() => remove(r.id)}
                />
              )}
            </HStack>
          ))
        )}
        {message ? <Banner status="error" title={message} /> : null}
        {theirs ? null : (
          <VStack gap={3} hAlign="stretch">
            <Heading level={3}>Add an entry</Heading>
            <Selector
              label="Repeats"
              options={[
                { value: "weekly", label: "Every week" },
                { value: "once", label: "On certain dates" },
              ]}
              value={kind}
              onChange={setKind}
            />
            {kind === "weekly" ? (
              <>
                <Selector
                  label="Day"
                  options={WEEKDAYS.map((w, i) => ({
                    value: String(i),
                    label: w,
                  }))}
                  value={weekday}
                  onChange={setWeekday}
                />
                <TextInput
                  label="From"
                  value={from}
                  onChange={setFrom}
                  placeholder="09:00"
                />
                <TextInput
                  label="To"
                  value={to}
                  onChange={setTo}
                  placeholder="17:30"
                />
              </>
            ) : (
              <>
                <TextInput
                  label="First day"
                  value={first}
                  onChange={setFirst}
                  placeholder="2026-12-24"
                />
                <TextInput
                  label="Last day"
                  value={last}
                  onChange={setLast}
                  placeholder="2026-12-26"
                  isOptional
                />
              </>
            )}
            <Selector
              label="They"
              options={[
                { value: "no", label: "Cannot work" },
                { value: "yes", label: "Can work" },
              ]}
              value={available}
              onChange={setAvailable}
            />
            <TextInput
              label="Note"
              value={note}
              onChange={setNote}
              isOptional
            />
            <Button
              label="Add entry"
              variant="primary"
              isLoading={pending}
              onClick={add}
            />
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
