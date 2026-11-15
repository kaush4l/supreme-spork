"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DateInput } from "@astryxdesign/core/DateInput";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { type ComponentProps, useRef, useState, useTransition } from "react";
import { uploadExpiryFile } from "../upload-file";
import { changeExpiryItem, fileLink, removeExpiryItem } from "./actions";

type Day = ComponentProps<typeof DateInput>["value"];

export type ItemFields = {
  id: string;
  title: string;
  reference: string | null;
  expiresOn: string;
  warnDays: number | null;
  note: string | null;
  hasFile: boolean;
};

/** Open the file, renew or correct the item, or take it back. Each write sends one key until it succeeds. */
export function ItemActions({
  venueId,
  item,
  isPerson,
}: {
  venueId: string;
  item: ItemFields;
  isPerson: boolean;
}) {
  const router = useRouter();
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(item.title);
  const [reference, setReference] = useState(item.reference ?? "");
  const [day, setDay] = useState<Day | undefined>(item.expiresOn as Day);
  const [warn, setWarn] = useState(
    item.warnDays === null ? "" : String(item.warnDays),
  );
  const [note, setNote] = useState(item.note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const keyFor = (sig: string) => {
    if (keyRef.current?.sig !== sig)
      keyRef.current = { sig, key: crypto.randomUUID() };
    return keyRef.current.key;
  };

  const fail = (m: { code: string; message: string }) => {
    setMessage(m.message);
    setStale(
      m.code === "item_changed" || /changed|Load it again/i.test(m.message),
    );
  };

  const openFile = () =>
    start(async () => {
      setMessage(null);
      const result = await fileLink({ venueId, itemId: item.id });
      if (!result.ok) return fail(result.error);
      window.open(result.data.url, "_blank", "noopener");
    });

  const save = () =>
    start(async () => {
      setMessage(null);
      setStale(false);
      if (!day) return setMessage("Choose the date it runs out.");
      const warnTrim = warn.trim();
      const warnDays = warnTrim === "" ? null : Number(warnTrim);
      if (warnDays !== null && !Number.isInteger(warnDays))
        return setMessage("Warn days must be a whole number.");
      const fields: Record<string, unknown> = {};
      if (title !== item.title) fields.title = title;
      if (reference.trim() !== (item.reference ?? ""))
        fields.reference = reference.trim() || null;
      if (day !== item.expiresOn) fields.expiresOn = day;
      if (warnDays !== item.warnDays) fields.warnDays = warnDays;
      if (note.trim() !== (item.note ?? "")) fields.note = note.trim() || null;
      try {
        if (file)
          fields.documentId = await uploadExpiryFile(
            venueId,
            file,
            isPerson ? "person" : "venue",
          );
      } catch (error) {
        return setMessage(
          error instanceof Error ? error.message : "The file did not upload.",
        );
      }
      if (Object.keys(fields).length === 0)
        return setMessage("Nothing has changed.");
      const result = await changeExpiryItem({
        venueId,
        itemId: item.id,
        key: keyFor(JSON.stringify(fields)),
        ...fields,
      });
      if (!result.ok) return fail(result.error);
      keyRef.current = null;
      router.push(`/venues/${venueId}/expiry/${result.data.id}`);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      setMessage(null);
      const result = await removeExpiryItem({
        venueId,
        itemId: item.id,
        key: keyFor("remove"),
      });
      if (!result.ok) return fail(result.error);
      keyRef.current = null;
      router.push(`/venues/${venueId}/expiry`);
      router.refresh();
    });

  return (
    <VStack gap={4} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {stale ? (
        <HStack gap={2}>
          <Button label="Reload this item" onClick={() => router.refresh()} />
        </HStack>
      ) : null}
      {item.hasFile ? (
        <HStack gap={2}>
          <Button
            label="Open the file"
            isLoading={pending}
            onClick={openFile}
          />
        </HStack>
      ) : (
        <Text type="supporting" color="secondary">
          No file is attached.
        </Text>
      )}
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Renew or correct</Heading>
          <DateInput label="Runs out on" value={day} onChange={setDay} />
          <TextInput label="Name" value={title} onChange={setTitle} size="lg" />
          <TextInput
            label="Licence or policy number"
            value={reference}
            onChange={setReference}
            isOptional
            size="lg"
          />
          <TextInput
            label="Days of warning"
            description="Empty uses the kind's usual warning."
            value={warn}
            onChange={setWarn}
            inputMode="numeric"
            isOptional
            size="lg"
          />
          <TextArea
            label="Note"
            isOptional
            maxLength={500}
            value={note}
            onChange={(v) => setNote(v)}
          />
          <label>
            <Text type="label">
              {item.hasFile ? "Replace the file" : "Add a file"} (a PDF or a
              photo)
            </Text>
            <input
              type="file"
              accept="application/pdf,image/*"
              disabled={pending}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <HStack gap={2}>
            <Button
              label="Save changes"
              variant="primary"
              isLoading={pending}
              onClick={save}
            />
          </HStack>
        </VStack>
      </Card>
      <Card padding={4}>
        <VStack gap={2} hAlign="start">
          <Heading level={2}>Take it back</Heading>
          <Text type="supporting" color="secondary">
            It stays in the history and is no longer reminded.
          </Text>
          {confirmRemove ? (
            <HStack gap={2}>
              <Button
                label="Yes, take it back"
                isLoading={pending}
                onClick={remove}
              />
              <Button
                label="Keep it"
                isDisabled={pending}
                onClick={() => setConfirmRemove(false)}
              />
            </HStack>
          ) : (
            <Button
              label="Take it back"
              onClick={() => setConfirmRemove(true)}
            />
          )}
        </VStack>
      </Card>
    </VStack>
  );
}
