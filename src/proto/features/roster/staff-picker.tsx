"use client";

import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useMemo, useState } from "react";
import { searchStaff } from "../../adapter";
import { staff } from "../../fixtures/staff";

const byId = new Map(staff.map((s) => [s.id, s]));
export function staffName(id: string | null): string {
  if (!id) return "Open shift";
  return byId.get(id)?.name ?? "Unknown staff";
}
export function staffRole(id: string | null): string | null {
  return id ? (byId.get(id)?.role ?? null) : null;
}

export const OPEN = "__open__";
const PAGE = 8;

/** Searchable, paged picker over all synthetic staff. Long names wrap; nothing is clipped. */
export function StaffPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const page = useMemo(() => searchStaff(staff, q, PAGE, offset), [q, offset]);
  const first = page.total === 0 ? 0 : page.offset + 1;
  const last = page.offset + page.items.length;
  return (
    <VStack gap={2} hAlign="stretch">
      <TextInput
        label="Search staff"
        description="Search by name or role across all staff"
        type="search"
        value={q}
        onChange={(v) => {
          setQ(v);
          setOffset(0);
        }}
        hasClear
        width="100%"
      />
      <Text type="supporting" as="p">
        {value
          ? `Assigned to: ${staffName(value)}`
          : "Assigned to: nobody (open shift)"}
      </Text>
      <Text type="supporting" as="p" aria-live="polite">
        {page.total === 0
          ? `No staff match "${q.trim()}".`
          : `Showing ${first} to ${last} of ${page.total} staff`}
      </Text>
      <RadioList
        label="Who works this shift"
        isLabelHidden
        value={value ?? OPEN}
        onChange={(v) => onChange(v === OPEN ? null : v)}
      >
        <RadioListItem value={OPEN} label="Open shift (no one assigned)" />
        {page.items.map((s) => (
          <RadioListItem
            key={s.id}
            value={s.id}
            aria-label={`${s.name}, ${s.role}`}
            label={
              <Text wordBreak="break-word" as="span">
                {s.name}
              </Text>
            }
            description={s.role}
          />
        ))}
      </RadioList>
      {page.total === 0 && (
        <Text type="supporting" as="p">
          Try a different spelling, or clear the search to see everyone.
        </Text>
      )}
      <HStack gap={2} wrap="wrap">
        <Button
          label="Previous staff"
          isDisabled={page.offset === 0}
          onClick={() => setOffset(Math.max(0, page.offset - PAGE))}
        />
        <Button
          label="Next staff"
          isDisabled={last >= page.total}
          onClick={() => setOffset(page.offset + PAGE)}
        />
      </HStack>
    </VStack>
  );
}
