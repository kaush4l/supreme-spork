"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addHoliday, removeHoliday } from "./actions";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A year's public holidays with a year picker; owners and partners add, rename and remove. */
export function HolidaysCard({
  venueId,
  year,
  holidays,
  canEdit,
}: {
  venueId: string;
  year: number;
  holidays: { date: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const base = `/venues/${venueId}/settings`;
  const [pending, start] = useTransition();
  const [addKey, setAddKey] = useState(() => crypto.randomUUID());
  const [removeKey, setRemoveKey] = useState(() => crypto.randomUUID());
  const [yearText, setYearText] = useState(String(year));
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const go = (y: number) => {
    setMessage(null);
    setSaved(null);
    setYearText(String(y));
    router.push(`${base}?year=${y}`);
  };
  const show = () => {
    if (!/^\d{4}$/.test(yearText.trim()))
      return setMessage("Enter a year with four digits, like 2026.");
    go(Number(yearText.trim()));
  };

  const add = () =>
    start(async () => {
      setMessage(null);
      setSaved(null);
      if (!DAY.test(date.trim()))
        return setMessage("Enter the date as year-month-day, like 2026-12-25.");
      if (!name.trim()) return setMessage("Name the holiday.");
      const result = await addHoliday({
        venueId,
        key: addKey,
        date: date.trim(),
        name: name.trim(),
      });
      if (!result.ok) return setMessage(result.error.message);
      setAddKey(crypto.randomUUID());
      setSaved("Holiday saved.");
      const y = Number(date.trim().slice(0, 4));
      setDate("");
      setName("");
      if (y !== year) go(y);
      else router.refresh();
    });

  const remove = (day: string) =>
    start(async () => {
      setMessage(null);
      setSaved(null);
      const result = await removeHoliday({
        venueId,
        key: removeKey,
        date: day,
      });
      if (!result.ok) return setMessage(result.error.message);
      setRemoveKey(crypto.randomUUID());
      setSaved("Holiday removed.");
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={4} hAlign="stretch">
        <Heading level={3}>Public holidays</Heading>
        <HStack gap={2} wrap="wrap" vAlign="end">
          <Button
            label="Earlier year"
            size="sm"
            isDisabled={pending}
            onClick={() => go(year - 1)}
          />
          <TextInput
            label="Year"
            inputMode="numeric"
            value={yearText}
            onChange={(v: string) => setYearText(v)}
            onEnter={show}
          />
          <Button label="Show year" size="sm" onClick={show} />
          <Button
            label="Later year"
            size="sm"
            isDisabled={pending}
            onClick={() => go(year + 1)}
          />
        </HStack>
        {message ? <Banner status="error" title={message} /> : null}
        {saved ? <Banner status="success" title={saved} /> : null}
        {holidays.length === 0 ? (
          <Text type="body">{`No public holidays are set for ${year}.`}</Text>
        ) : (
          holidays.map((h) => (
            <HStack key={h.date} gap={3} wrap="wrap" vAlign="center">
              <VStack gap={0} hAlign="start">
                <Text type="body">{h.name}</Text>
                <Text type="supporting" color="secondary">
                  {h.date}
                </Text>
              </VStack>
              {canEdit ? (
                <>
                  <Button
                    label={`Rename ${h.name}`}
                    size="sm"
                    isDisabled={pending}
                    onClick={() => {
                      setDate(h.date);
                      setName(h.name);
                    }}
                  />
                  <Button
                    label={`Remove ${h.name}`}
                    size="sm"
                    isLoading={pending}
                    onClick={() => remove(h.date)}
                  />
                </>
              ) : null}
            </HStack>
          ))
        )}
        {canEdit ? (
          <VStack gap={3} hAlign="stretch">
            <Heading level={4}>Add or rename a holiday</Heading>
            <TextInput
              label="Holiday date"
              description="Year-month-day, like 2026-12-25"
              value={date}
              isDisabled={pending}
              onChange={(v: string) => setDate(v)}
            />
            <TextInput
              label="Holiday name"
              value={name}
              isDisabled={pending}
              onChange={(v: string) => setName(v)}
            />
            <Button
              label="Save holiday"
              variant="primary"
              size="lg"
              isLoading={pending}
              onClick={add}
            />
          </VStack>
        ) : null}
      </VStack>
    </Card>
  );
}
