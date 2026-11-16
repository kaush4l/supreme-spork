"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TimeInput } from "@astryxdesign/core/TimeInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { changeTemplate, createTemplate } from "./actions";
import {
  dayOptions,
  emptySlot,
  fromTemplate,
  type SlotDraft,
  toPayload,
} from "./slots";

type Existing = {
  id: string;
  name: string;
  lengthDays: number;
  active: boolean;
  slots: {
    day: number;
    position: string;
    start: string;
    end: string;
    count: number;
  }[];
};

const LENGTHS = [
  { value: "1", label: "One day" },
  { value: "7", label: "One week" },
  { value: "14", label: "Two weeks" },
];

/** Make a template (`existing` null) or edit one. The length is fixed once it is made, as the backend requires. */
export function TemplateForm({
  venueId,
  positions,
  existing,
}: {
  venueId: string;
  positions: string[];
  existing: Existing | null;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(existing?.name ?? "");
  const [length, setLength] = useState(String(existing?.lengthDays ?? 7));
  const [slots, setSlots] = useState<SlotDraft[]>(() =>
    existing
      ? fromTemplate(existing.slots, () => crypto.randomUUID())
      : [emptySlot(crypto.randomUUID())],
  );
  const [busy, setBusy] = useState<"save" | "retire" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const days = dayOptions(Number(length));
  const patch = (k: string, change: Partial<SlotDraft>) =>
    setSlots((all) => all.map((s) => (s.key === k ? { ...s, ...change } : s)));

  const save = guard(async () => {
    setBusy("save");
    setMessage(null);
    setSaved(false);
    if (existing) {
      const r = await changeTemplate({
        venueId,
        templateId: existing.id,
        name,
        slots: toPayload(slots),
      });
      setBusy(null);
      if (!r.ok) return setMessage(r.error.message);
      setSaved(true);
      router.refresh();
      return;
    }
    const r = await createTemplate({
      venueId,
      key,
      name,
      lengthDays: Number(length) as 1 | 7 | 14,
      slots: toPayload(slots),
    });
    if (!r.ok) {
      setBusy(null);
      return setMessage(r.error.message);
    }
    setKey(crypto.randomUUID());
    router.push(`/venues/${venueId}/roster/templates/${r.data.templateId}`);
  });

  const retire = guard(async () => {
    if (!existing) return;
    setBusy("retire");
    setMessage(null);
    const r = await changeTemplate({
      venueId,
      templateId: existing.id,
      active: !existing.active,
    });
    setBusy(null);
    if (!r.ok) return setMessage(r.error.message);
    router.refresh();
  });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>
          {existing ? "Edit this template" : "Make a template"}
        </Heading>
        {message ? <Banner status="error" title={message} /> : null}
        {saved ? <Banner status="success" title="Saved." /> : null}
        <TextInput label="Name" value={name} onChange={setName} />
        {existing ? (
          <Text type="supporting" color="secondary">
            Length: {LENGTHS.find((l) => l.value === length)?.label}. To change
            the length, make a new template.
          </Text>
        ) : (
          <Selector
            label="How long"
            value={length}
            options={LENGTHS}
            onChange={(v) => {
              setLength(v);
              setSlots((all) => all.map((s) => ({ ...s, day: "0" })));
            }}
          />
        )}
        <VStack gap={3} hAlign="stretch">
          <Heading level={3}>What each day needs</Heading>
          {slots.length === 0 ? (
            <Text type="supporting" color="secondary">
              No shifts yet. Add one below.
            </Text>
          ) : null}
          {slots.map((s, i) => (
            <Card key={s.key} padding={3}>
              <VStack gap={2} hAlign="stretch">
                <Text type="supporting" color="secondary">
                  Shift {i + 1}
                </Text>
                <Selector
                  label="Day"
                  value={s.day}
                  options={days}
                  onChange={(v) => patch(s.key, { day: v })}
                />
                <Selector
                  label="Position"
                  value={s.position || undefined}
                  options={positions}
                  placeholder="Choose a position"
                  onChange={(v) => patch(s.key, { position: v })}
                />
                <HStack gap={2} wrap="wrap">
                  <TimeInput
                    label="Starts"
                    value={s.start as never}
                    onChange={(v) => v && patch(s.key, { start: v })}
                  />
                  <TimeInput
                    label="Ends"
                    value={s.end as never}
                    onChange={(v) => v && patch(s.key, { end: v })}
                  />
                </HStack>
                <NumberInput
                  label="How many people"
                  value={s.count}
                  min={1}
                  max={50}
                  onChange={(v) => patch(s.key, { count: v })}
                />
                <HStack>
                  <Button
                    label="Remove shift"
                    size="sm"
                    onClick={() =>
                      setSlots((all) => all.filter((x) => x.key !== s.key))
                    }
                  />
                </HStack>
              </VStack>
            </Card>
          ))}
          <HStack>
            <Button
              label="Add a shift"
              variant="secondary"
              onClick={() =>
                setSlots((all) => [...all, emptySlot(crypto.randomUUID())])
              }
            />
          </HStack>
          <Text type="supporting" color="secondary">
            An end time at or before the start means the shift finishes the next
            morning. Times are in the venue's time.
          </Text>
        </VStack>
        <HStack gap={2} wrap="wrap">
          <Button
            label={existing ? "Save changes" : "Save template"}
            variant="primary"
            isLoading={busy === "save"}
            isDisabled={busy !== null}
            onClick={save}
          />
          {existing ? (
            <Button
              label={existing.active ? "Retire template" : "Bring it back"}
              isLoading={busy === "retire"}
              isDisabled={busy !== null}
              onClick={retire}
            />
          ) : null}
        </HStack>
      </VStack>
    </Card>
  );
}
