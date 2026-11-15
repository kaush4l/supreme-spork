"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addItem, changeItem } from "../actions";

export type ItemView = {
  itemKey: string;
  label: string;
  kind: string;
  required: boolean;
  instruction: string;
  min: number | null;
  max: number | null;
};

const KIND_WORDS: Record<string, string> = {
  tick: "Tick",
  number: "Number",
  note: "Note",
  photo: "Photo",
};
const KIND_OPTIONS = Object.entries(KIND_WORDS).map(([value, label]) => ({
  value,
  label,
}));

/** Blank number text means "no limit"; anything else must be a number. */
function toNumber(text: string): number | null | "bad" {
  if (!text.trim()) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : "bad";
}

type Draft = Omit<ItemView, "itemKey" | "min" | "max"> & {
  min: string;
  max: string;
};

function ItemFields({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
}) {
  return (
    <VStack gap={2} hAlign="stretch">
      <TextInput
        label="What to check"
        value={draft.label}
        onChange={(label) => setDraft({ ...draft, label })}
        isRequired
      />
      <Selector
        label="Answer with"
        options={KIND_OPTIONS}
        value={draft.kind}
        onChange={(kind) => setDraft({ ...draft, kind })}
      />
      <CheckboxInput
        label="Must be done to finish the list"
        value={draft.required}
        onChange={(required) => setDraft({ ...draft, required })}
      />
      <TextInput
        label="Instruction"
        value={draft.instruction}
        onChange={(instruction) => setDraft({ ...draft, instruction })}
        isOptional
      />
      {draft.kind === "number" ? (
        <HStack gap={2}>
          <TextInput
            label="Lowest allowed"
            value={draft.min}
            onChange={(min) => setDraft({ ...draft, min })}
            inputMode="decimal"
            isOptional
          />
          <TextInput
            label="Highest allowed"
            value={draft.max}
            onChange={(max) => setDraft({ ...draft, max })}
            inputMode="decimal"
            isOptional
          />
        </HStack>
      ) : null}
    </VStack>
  );
}

function payload(draft: Draft) {
  const min = draft.kind === "number" ? toNumber(draft.min) : null;
  const max = draft.kind === "number" ? toNumber(draft.max) : null;
  if (min === "bad" || max === "bad") return null;
  return {
    label: draft.label,
    kind:
      (["tick", "number", "note", "photo"] as const).find(
        (k) => k === draft.kind,
      ) ?? "tick",
    required: draft.required,
    instruction: draft.instruction.trim() ? draft.instruction : null,
    minValue: min,
    maxValue: max,
  };
}

export function ItemEditor({
  venueId,
  templateKey,
  item,
}: {
  venueId: string;
  templateKey: string;
  item: ItemView;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    label: item.label,
    kind: item.kind,
    required: item.required,
    instruction: item.instruction,
    min: item.min === null ? "" : String(item.min),
    max: item.max === null ? "" : String(item.max),
  });

  const range =
    item.kind === "number" && (item.min !== null || item.max !== null)
      ? ` (${item.min ?? "any"} to ${item.max ?? "any"})`
      : "";

  const save = () =>
    start(async () => {
      const body = payload(draft);
      if (!body) return setMessage("Lowest and highest must be numbers.");
      const result = await changeItem({
        venueId,
        templateKey,
        itemKey: item.itemKey,
        ...body,
      });
      if (!result.ok) return setMessage(result.error.message);
      setMessage(null);
      setOpen(false);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const result = await changeItem({
        venueId,
        templateKey,
        itemKey: item.itemKey,
        remove: true,
        label: item.label,
        kind: "tick",
        required: false,
        instruction: null,
        minValue: null,
        maxValue: null,
      });
      if (!result.ok) return setMessage(result.error.message);
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <Text type="body">{item.label}</Text>
        <Text type="supporting" color="secondary">
          {KIND_WORDS[item.kind] ?? item.kind}
          {range}
          {item.required ? ", required" : ""}
          {item.instruction ? `. ${item.instruction}` : ""}
        </Text>
        {open ? <ItemFields draft={draft} setDraft={setDraft} /> : null}
        {message ? <Banner status="error" title={message} /> : null}
        <HStack gap={2}>
          {open ? (
            <>
              <Button
                label="Save"
                variant="primary"
                isLoading={pending}
                onClick={save}
              />
              <Button label="Cancel" onClick={() => setOpen(false)} />
            </>
          ) : (
            <>
              <Button label="Edit" onClick={() => setOpen(true)} />
              <Button
                label="Remove"
                variant="destructive"
                isLoading={pending}
                onClick={remove}
              />
            </>
          )}
        </HStack>
      </VStack>
    </Card>
  );
}

export function NewItem({
  venueId,
  templateKey,
}: {
  venueId: string;
  templateKey: string;
}) {
  const router = useRouter();
  const blank: Draft = {
    label: "",
    kind: "tick",
    required: false,
    instruction: "",
    min: "",
    max: "",
  };
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft>(blank);
  const [message, setMessage] = useState<string | null>(null);

  const add = () =>
    start(async () => {
      const body = payload(draft);
      if (!body) return setMessage("Lowest and highest must be numbers.");
      const result = await addItem({ venueId, templateKey, key, ...body });
      if (!result.ok) return setMessage(result.error.message);
      setMessage(null);
      setDraft(blank);
      setKey(crypto.randomUUID());
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Add an item</Heading>
        <ItemFields draft={draft} setDraft={setDraft} />
        {message ? <Banner status="error" title={message} /> : null}
        <Button
          label="Add item"
          variant="primary"
          isLoading={pending}
          onClick={add}
        />
      </VStack>
    </Card>
  );
}
