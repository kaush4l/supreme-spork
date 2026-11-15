"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DateInput } from "@astryxdesign/core/DateInput";
import { VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TimeInput } from "@astryxdesign/core/TimeInput";
import { useRouter } from "next/navigation";
import { type ComponentProps, useRef, useState, useTransition } from "react";
import { WEEKDAY_OPTIONS } from "@/server/data/person-text";
import { addAvailability, removeAvailability } from "./actions";

type Day = ComponentProps<typeof DateInput>["value"];
type Time = ComponentProps<typeof TimeInput>["value"];
type Row = {
  id: string;
  when: string;
  available: boolean;
  note: string | null;
};

/** Your rows, and one form to add a weekly window or a date range. Each write is guarded against a double click. */
export function Availability({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const [kind, setKind] = useState<"weekly" | "once">("weekly");
  const [can, setCan] = useState("no");
  const [weekday, setWeekday] = useState("0");
  const [from, setFrom] = useState<Time>(undefined);
  const [to, setTo] = useState<Time>(undefined);
  const [first, setFirst] = useState<Day>(undefined);
  const [last, setLast] = useState<Day>(undefined);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const guarded = (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        await fn();
      } finally {
        busy.current = false;
      }
    });
  };

  const add = () =>
    guarded(async () => {
      setMessage(null);
      setNotice(null);
      const weeklyOk = kind === "weekly" && from && to;
      const onceOk = kind === "once" && first;
      if (!weeklyOk && !onceOk) {
        setMessage(
          kind === "weekly"
            ? "Choose a start and an end time."
            : "Choose the first day.",
        );
        return;
      }
      const result = await addAvailability({
        key,
        kind,
        available: can === "yes",
        note: note.trim() || undefined,
        ...(kind === "weekly"
          ? {
              weekday: Number(weekday),
              fromTime: String(from),
              toTime: String(to),
            }
          : {
              startDate: String(first),
              endDate: last ? String(last) : String(first),
            }),
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setKey(crypto.randomUUID());
      setNotice("Added.");
      setNote("");
      router.refresh();
    });

  const remove = (id: string) =>
    guarded(async () => {
      setMessage(null);
      setNotice(null);
      const result = await removeAvailability({ rowId: id });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setNotice("Removed.");
      router.refresh();
    });

  return (
    <VStack gap={4} hAlign="stretch">
      {rows.length === 0 ? (
        <Text type="body">You have not set any availability yet.</Text>
      ) : (
        <VStack gap={2} hAlign="stretch">
          {rows.map((row) => (
            <Card key={row.id} padding={4}>
              <VStack gap={2}>
                <Text type="body">{row.when}</Text>
                <Text type="supporting" color="secondary">
                  {row.available ? "I can work" : "I cannot work"}
                  {row.note ? `. ${row.note}` : ""}
                </Text>
                <Button
                  label="Remove"
                  variant="destructive"
                  isDisabled={pending}
                  onClick={() => remove(row.id)}
                />
              </VStack>
            </Card>
          ))}
        </VStack>
      )}

      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Add availability</Heading>
          {message ? <Banner status="error" title={message} /> : null}
          {notice ? <Banner status="success" title={notice} /> : null}
          <Selector
            label="How often"
            value={kind}
            options={[
              { value: "weekly", label: "Every week" },
              { value: "once", label: "One day or a run of days" },
            ]}
            onChange={(v) => setKind(v === "once" ? "once" : "weekly")}
          />
          <Selector
            label="On these times"
            value={can}
            options={[
              { value: "no", label: "I cannot work" },
              { value: "yes", label: "I can work" },
            ]}
            onChange={setCan}
          />
          {kind === "weekly" ? (
            <>
              <Selector
                label="Day of the week"
                value={weekday}
                options={WEEKDAY_OPTIONS}
                onChange={setWeekday}
              />
              <TimeInput label="From" value={from} onChange={setFrom} />
              <TimeInput label="Until" value={to} onChange={setTo} />
            </>
          ) : (
            <>
              <DateInput label="First day" value={first} onChange={setFirst} />
              <DateInput
                label="Last day"
                description="Leave empty for one day."
                value={last}
                onChange={setLast}
                hasClear
              />
            </>
          )}
          <TextInput
            label="Note"
            value={note}
            onChange={setNote}
            isOptional
            size="lg"
          />
          <Button
            label="Add"
            variant="primary"
            size="lg"
            isLoading={pending}
            onClick={add}
          />
        </VStack>
      </Card>
    </VStack>
  );
}
