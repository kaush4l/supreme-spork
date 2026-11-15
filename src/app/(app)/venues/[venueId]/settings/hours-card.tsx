"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveHours } from "./actions";
import {
  type Day,
  type DayDraft,
  dayWords,
  hoursChanges,
  toDayDraft,
} from "./venue-logic";

/** The week as the API returns it (Monday first). Owners and partners edit; everyone else reads it in words. */
export function HoursCard({
  venueId,
  days,
  canEdit,
}: {
  venueId: string;
  days: Day[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<number, DayDraft>>(() =>
    Object.fromEntries(days.map((d) => [d.dow, toDayDraft(d)])),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const change = (d: Day, patch: Partial<DayDraft>) => {
    setSaved(null);
    setDrafts((now) => ({
      ...now,
      [d.dow]: { ...(now[d.dow] ?? toDayDraft(d)), ...patch },
    }));
  };

  const save = () =>
    start(async () => {
      setMessage(null);
      setSaved(null);
      const { changes, bad } = hoursChanges(days, drafts);
      if (bad.length > 0) {
        setMessage(
          `Check the times for: ${bad.join(", ")}. Use hours and minutes like 09:00, and a different closing time.`,
        );
        return;
      }
      if (changes.length === 0) {
        setSaved("Nothing changed.");
        return;
      }
      const result = await saveHours({ venueId, key, days: changes });
      if (!result.ok) return setMessage(result.error.message);
      setKey(crypto.randomUUID());
      setSaved("Opening hours saved.");
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={4} hAlign="stretch">
        <Heading level={3}>Opening hours</Heading>
        {message ? <Banner status="error" title={message} /> : null}
        {saved ? <Banner status="success" title={saved} /> : null}
        {days.map((d) => {
          const draft = drafts[d.dow] ?? toDayDraft(d);
          return (
            <VStack key={d.dow} gap={1} hAlign="stretch">
              <Text type="body">{d.day}</Text>
              {canEdit ? (
                <HStack gap={3} wrap="wrap" vAlign="end">
                  <TextInput
                    label={`${d.day} opens`}
                    placeholder="09:00"
                    value={draft.closed ? "" : draft.opens}
                    isDisabled={pending || draft.closed}
                    onChange={(v: string) => change(d, { opens: v })}
                  />
                  <TextInput
                    label={`${d.day} closes`}
                    placeholder="17:00"
                    value={draft.closed ? "" : draft.closes}
                    isDisabled={pending || draft.closed}
                    onChange={(v: string) => change(d, { closes: v })}
                  />
                  <Switch
                    label={`${d.day}: closed`}
                    description="Closed"
                    value={draft.closed}
                    isDisabled={pending}
                    onChange={(checked: boolean) =>
                      change(d, { closed: checked })
                    }
                  />
                </HStack>
              ) : (
                <Text type="supporting" color="secondary">
                  {dayWords(d)}
                </Text>
              )}
              {canEdit && d.set ? (
                <Text type="supporting" color="secondary">
                  Now: {dayWords(d)}
                </Text>
              ) : null}
            </VStack>
          );
        })}
        {canEdit ? (
          <VStack gap={2} hAlign="start">
            <Text type="supporting" color="secondary">
              To close after midnight, give a closing time earlier than the
              opening time (for example 17:00 to 01:00).
            </Text>
            <Button
              label="Save opening hours"
              variant="primary"
              size="lg"
              isLoading={pending}
              onClick={save}
            />
          </VStack>
        ) : null}
      </VStack>
    </Card>
  );
}
