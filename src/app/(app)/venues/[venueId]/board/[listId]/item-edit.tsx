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
import type { ListItem } from "@/server/data/lists";
import { useGuard } from "../../bills/guarded";
import { addListItem, changeListItem, removeListItem } from "./actions";

const KIND_OPTIONS = [
  { value: "tick", label: "Tick" },
  { value: "number", label: "Number" },
  { value: "note", label: "Note" },
  { value: "photo", label: "Photo" },
];

type Draft = {
  label: string;
  kind: string;
  required: boolean;
  instruction: string;
  min: string;
  max: string;
  order: string;
};

type Parsed = {
  label: string;
  kind: "tick" | "number" | "note" | "photo";
  required: boolean;
  instruction: string | null;
  minValue: number | null;
  maxValue: number | null;
  sortOrder: number;
};

/** Blank means "no limit"; anything else must be a number. Returns null when something is not a number. */
function parse(d: Draft): Parsed | null {
  const num = (t: string) => (t.trim() === "" ? null : Number(t));
  const min = d.kind === "number" ? num(d.min) : null;
  const max = d.kind === "number" ? num(d.max) : null;
  const order = d.order.trim() === "" ? 0 : Number(d.order);
  if (
    (min !== null && !Number.isFinite(min)) ||
    (max !== null && !Number.isFinite(max)) ||
    !Number.isInteger(order) ||
    order < 0
  )
    return null;
  const kind = KIND_OPTIONS.find((k) => k.value === d.kind)?.value ?? "tick";
  return {
    label: d.label,
    kind: kind as Parsed["kind"],
    required: d.required,
    instruction: d.instruction.trim() ? d.instruction : null,
    minValue: min,
    maxValue: max,
    sortOrder: order,
  };
}

function Fields({
  draft,
  setDraft,
  withOrder,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  withOrder: boolean;
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
      {withOrder ? (
        <TextInput
          label="Place in the list (0 is first)"
          value={draft.order}
          onChange={(order) => setDraft({ ...draft, order })}
          inputMode="numeric"
        />
      ) : null}
    </VStack>
  );
}

/** A manager changes one item on this list only: wording, kind, range, required, place, or takes an added item off. */
export function ItemEdit({
  venueId,
  listId,
  item,
}: {
  venueId: string;
  listId: string;
  item: ListItem;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    label: item.label,
    kind: item.kind,
    required: item.required,
    instruction: item.instruction ?? "",
    min: item.min_value === null ? "" : String(item.min_value),
    max: item.max_value === null ? "" : String(item.max_value),
    order: String(item.sort_order ?? 0),
  });

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    new Promise<void>((resolve) =>
      start(async () => {
        setMessage(null);
        const r = await fn();
        if (r.ok) {
          setOpen(false);
          router.refresh();
        } else setMessage(r.message ?? "That did not work.");
        resolve();
      }),
    );

  const save = guard(() => {
    const body = parse(draft);
    if (!body) {
      setMessage("Lowest, highest and place must be numbers.");
      return Promise.resolve();
    }
    return run(async () => {
      const result = await changeListItem({
        venueId,
        listId,
        itemKey: item.item_key,
        ...body,
      });
      return result.ok
        ? { ok: true }
        : { ok: false, message: result.error.message };
    });
  });

  const remove = guard(() =>
    run(async () => {
      const result = await removeListItem({
        venueId,
        listId,
        itemKey: item.item_key,
      });
      return result.ok
        ? { ok: true }
        : { ok: false, message: result.error.message };
    }),
  );

  return (
    <VStack gap={2} hAlign="stretch">
      {open ? <Fields draft={draft} setDraft={setDraft} withOrder /> : null}
      {message ? <Banner status="error" title={message} /> : null}
      <HStack gap={2}>
        {open ? (
          <>
            <Button
              label="Save changes"
              variant="primary"
              isLoading={pending}
              onClick={save}
            />
            <Button label="Cancel" onClick={() => setOpen(false)} />
          </>
        ) : (
          <>
            <Button
              label={`Change “${item.label}”`}
              size="sm"
              onClick={() => setOpen(true)}
            />
            <Button
              label="Take off this list"
              size="sm"
              variant="destructive"
              isLoading={pending}
              onClick={remove}
            />
          </>
        )}
      </HStack>
      {open ? null : (
        <Text type="supporting" color="secondary">
          {item.origin === "template"
            ? "Comes from the template: it can be changed here, or marked not applicable, but not taken off."
            : "Added to this list only."}
        </Text>
      )}
    </VStack>
  );
}

/** Add an item to this one list (the template is not changed). One key per attempt, replaced after it worked. */
export function AddListItem({
  venueId,
  listId,
}: {
  venueId: string;
  listId: string;
}) {
  const router = useRouter();
  const guard = useGuard();
  const blank: Draft = {
    label: "",
    kind: "tick",
    required: false,
    instruction: "",
    min: "",
    max: "",
    order: "0",
  };
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft>(blank);
  const [message, setMessage] = useState<string | null>(null);

  const add = guard(
    () =>
      new Promise<void>((resolve) => {
        const body = parse(draft);
        if (!body) {
          setMessage("Lowest and highest must be numbers.");
          return resolve();
        }
        const { sortOrder: _order, ...fields } = body;
        start(async () => {
          const result = await addListItem({ venueId, listId, key, ...fields });
          if (result.ok) {
            setMessage(null);
            setDraft(blank);
            setKey(crypto.randomUUID());
            router.refresh();
          } else setMessage(result.error.message);
          resolve();
        });
      }),
  );

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Add an item to this list</Heading>
        <Text type="supporting" color="secondary">
          Only this list gets it. The checklist it came from is not changed.
        </Text>
        <Fields draft={draft} setDraft={setDraft} withOrder={false} />
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
