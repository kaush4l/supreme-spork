"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { VenueSettings } from "@/server/data/venue-settings";
import { saveVenueSettings } from "./actions";
import { NUMBER_FIELDS, parseClock, parseNumber } from "./venue-logic";

/** The venue's name, time zone, trading day start and targets. One save; only what changed is sent. */
export function VenueCard({
  venueId,
  settings,
  canEdit,
}: {
  venueId: string;
  settings: VenueSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const numbers = NUMBER_FIELDS.filter((f) => settings[f.key] !== undefined);
  const [name, setName] = useState(settings.name);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [dayStart, setDayStart] = useState(settings.trading_day_start);
  const [nums, setNums] = useState<Record<string, string>>(() =>
    Object.fromEntries(numbers.map((f) => [f.key, String(settings[f.key])])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const edit = (fn: () => void) => {
    setSaved(null);
    fn();
  };

  const save = () =>
    start(async () => {
      setMessage(null);
      setSaved(null);
      const changes: Record<string, string | number> = {};
      if (name.trim() !== settings.name) {
        if (!name.trim()) return setMessage("Give the venue a name.");
        changes.name = name.trim();
      }
      if (timezone.trim() !== settings.timezone)
        changes.timezone = timezone.trim();
      if (dayStart !== settings.trading_day_start) {
        const t = parseClock(dayStart);
        if (!t)
          return setMessage(
            "Check the trading day start. Use hours and minutes, like 04:00.",
          );
        if (t !== settings.trading_day_start) changes.trading_day_start = t;
      }
      for (const f of numbers) {
        const typed = nums[f.key] ?? "";
        const n = parseNumber(typed, f);
        if (n === null) return setMessage(`Check the number for: ${f.label}.`);
        if (n !== settings[f.key]) changes[f.key] = n;
      }
      if (Object.keys(changes).length === 0) {
        setSaved("Nothing changed.");
        return;
      }
      const result = await saveVenueSettings({ venueId, key, changes });
      if (!result.ok) return setMessage(result.error.message);
      setKey(crypto.randomUUID());
      setSaved(
        result.data.changed ? "Venue settings saved." : "Nothing changed.",
      );
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={4} hAlign="stretch">
        <Heading level={3}>Venue</Heading>
        {message ? <Banner status="error" title={message} /> : null}
        {saved ? <Banner status="success" title={saved} /> : null}
        <TextInput
          label="Venue name"
          value={name}
          isDisabled={!canEdit || pending}
          onChange={(v: string) => edit(() => setName(v))}
        />
        <TextInput
          label="Time zone"
          description="For example Australia/Sydney"
          value={timezone}
          isDisabled={!canEdit || pending}
          onChange={(v: string) => edit(() => setTimezone(v))}
        />
        <TextInput
          label="Trading day starts at"
          description="Hours and minutes, like 04:00. Sales after midnight count to the day before until then."
          value={dayStart}
          isDisabled={!canEdit || pending}
          onChange={(v: string) => edit(() => setDayStart(v))}
        />
        {numbers.map((f) => (
          <VStack key={f.key} gap={1} hAlign="stretch">
            <TextInput
              label={`${f.label} (${f.unit})`}
              description={`${f.help} ${f.minExclusive ? "Above" : "From"} ${f.min} ${f.maxExclusive ? "to below" : "to"} ${f.max}.`}
              inputMode="decimal"
              value={nums[f.key] ?? ""}
              isDisabled={!canEdit || pending}
              onChange={(v: string) =>
                edit(() => setNums((now) => ({ ...now, [f.key]: v })))
              }
            />
          </VStack>
        ))}
        {numbers.length === 0 ? (
          <Text type="supporting" color="secondary">
            Targets are shown to the owner, partners, managers and bookkeepers.
          </Text>
        ) : null}
        {canEdit ? (
          <Button
            label="Save venue settings"
            variant="primary"
            size="lg"
            isLoading={pending}
            onClick={save}
          />
        ) : (
          <Text type="supporting" color="secondary">
            You can see the venue details. The owner and partners change them.
          </Text>
        )}
      </VStack>
    </Card>
  );
}
