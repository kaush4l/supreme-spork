"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { DateInput } from "@astryxdesign/core/DateInput";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { type ComponentProps, useRef, useState, useTransition } from "react";
import type { ExpiryKind } from "@/server/data/expiry";
import { addExpiryItem } from "./actions";
import { uploadExpiryFile } from "./upload-file";

type Day = ComponentProps<typeof DateInput>["value"];

/** Add an item. Person kinds (HR files) are only in `kinds` for someone who may see them; the backend still decides. */
export function AddItemForm({
  venueId,
  kinds,
  canPerson,
  people,
}: {
  venueId: string;
  kinds: ExpiryKind[];
  canPerson: boolean;
  people: { ref: string; name: string }[];
}) {
  const router = useRouter();
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState("");
  const [person, setPerson] = useState("");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [day, setDay] = useState<Day | undefined>();
  const [warn, setWarn] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const offered = kinds.filter((k) => canPerson || k.scope === "venue");
  const chosen = offered.find((k) => k.code === kind);
  const isPerson = chosen?.scope === "person";

  const submit = () =>
    start(async () => {
      setMessage(null);
      setDone(false);
      if (!chosen) return setMessage("Choose what kind of item it is.");
      if (isPerson && !person) return setMessage("Choose the person.");
      if (!day) return setMessage("Choose the date it runs out.");
      const warnDays = warn.trim() === "" ? undefined : Number(warn.trim());
      if (warnDays !== undefined && !Number.isInteger(warnDays))
        return setMessage("Warn days must be a whole number.");
      let documentId: string | undefined;
      try {
        if (file)
          documentId = await uploadExpiryFile(
            venueId,
            file,
            isPerson ? "person" : "venue",
          );
      } catch (error) {
        return setMessage(
          error instanceof Error ? error.message : "The file did not upload.",
        );
      }
      const fields = {
        kind: chosen.code,
        staffRef: isPerson ? person : undefined,
        title,
        reference: reference.trim() || undefined,
        expiresOn: day,
        warnDays,
        note: note.trim() || undefined,
        documentId,
      };
      const sig = JSON.stringify(fields);
      if (keyRef.current?.sig !== sig)
        keyRef.current = { sig, key: crypto.randomUUID() };
      const result = await addExpiryItem({
        venueId,
        key: keyRef.current.key,
        ...fields,
      });
      if (!result.ok) return setMessage(result.error.message);
      keyRef.current = null;
      setKind("");
      setPerson("");
      setTitle("");
      setReference("");
      setDay(undefined);
      setWarn("");
      setNote("");
      setFile(null);
      setFileKey((k) => k + 1);
      setDone(true);
      router.refresh();
    });

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {done ? <Banner status="success" title="Item added." /> : null}
      <Selector
        label="Kind"
        placeholder="Choose a kind"
        options={offered.map((k) => ({ value: k.code, label: k.label }))}
        value={kind}
        onChange={setKind}
      />
      {isPerson ? (
        <Selector
          label="Person"
          placeholder="Choose a person"
          options={people.map((p) => ({ value: p.ref, label: p.name }))}
          value={person}
          onChange={setPerson}
          hasSearch
        />
      ) : null}
      <TextInput
        label="Name"
        value={title}
        onChange={setTitle}
        isRequired
        size="lg"
      />
      <TextInput
        label="Licence or policy number"
        value={reference}
        onChange={setReference}
        isOptional
        size="lg"
      />
      <DateInput label="Runs out on" value={day} onChange={setDay} />
      <TextInput
        label="Days of warning"
        description={
          chosen
            ? `Left empty: ${chosen.default_warn_days} days.`
            : "Left empty, the kind's usual warning."
        }
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
        <Text type="label">File (a PDF or a photo)</Text>
        <input
          key={fileKey}
          type="file"
          accept="application/pdf,image/*"
          disabled={pending}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <HStack gap={2}>
        <Button
          label="Add item"
          variant="primary"
          isLoading={pending}
          onClick={submit}
        />
      </HStack>
    </VStack>
  );
}
