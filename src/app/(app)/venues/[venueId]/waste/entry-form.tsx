"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordWaste } from "./actions";
import { uploadWastePhoto } from "./upload-photo";

export type ItemOption = {
  id: string;
  name: string;
  kind: string;
  unit: string | null;
};
export type ReasonOption = { code: string; label: string };

const unitWords = (item: ItemOption) =>
  item.kind === "menu_item" ? "portions" : (item.unit ?? "");

/** Record something thrown away. One key per entry: a double tap or a retry writes once; a success starts a new one. */
export function EntryForm({
  venueId,
  items,
  reasons,
}: {
  venueId: string;
  items: ItemOption[];
  reasons: ReasonOption[];
}) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const item = items.find((i) => i.id === itemId);

  const submit = () =>
    start(async () => {
      setMessage(null);
      setSaved(false);
      if (!item) return setMessage("Choose what was thrown away.");
      if (qty === null || qty <= 0)
        return setMessage("Enter how much was thrown away.");
      if (!reason) return setMessage("Choose a reason.");
      let photoDocumentId: string | undefined;
      if (photo) {
        try {
          photoDocumentId = await uploadWastePhoto(venueId, photo);
        } catch (error) {
          return setMessage(
            error instanceof Error && error.message
              ? error.message
              : "The photo did not upload. Please try again.",
          );
        }
      }
      const result = await recordWaste({
        venueId,
        key,
        itemId: item.id,
        qty,
        unit: item.kind === "menu_item" ? "each" : (item.unit ?? ""),
        reason,
        note: note.trim() || undefined,
        photoDocumentId,
      });
      if (!result.ok) return setMessage(result.error.message);
      setKey(crypto.randomUUID());
      setItemId("");
      setQty(null);
      setReason("");
      setNote("");
      setPhoto(null);
      setFileKey((n) => n + 1);
      setSaved(true);
      router.refresh();
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Record waste</Heading>
        <Selector
          label="What was thrown away"
          placeholder="Search for an item"
          searchPlaceholder="Type a name"
          hasSearch
          size="lg"
          value={itemId}
          onChange={setItemId}
          options={items.map((i) => ({
            value: i.id,
            label: i.name,
            disabled: i.kind !== "menu_item" && !i.unit,
            description:
              i.kind === "menu_item"
                ? "Dish, in portions"
                : i.unit
                  ? `Counted in ${i.unit}`
                  : "No unit set yet",
          }))}
          emptyText="No items to choose from yet."
          emptySearchText="Nothing matches that."
        />
        <NumberInput
          label={item ? `How much (${unitWords(item)})` : "How much"}
          size="lg"
          value={qty}
          onChange={setQty}
          min={0}
        />
        <Selector
          label="Why"
          placeholder="Choose a reason"
          size="lg"
          value={reason}
          onChange={setReason}
          options={reasons.map((r) => ({ value: r.code, label: r.label }))}
        />
        <TextArea
          label="Note"
          isOptional
          value={note}
          onChange={setNote}
          maxLength={500}
        />
        <label>
          <Text type="supporting" color="secondary">
            {photo ? `Photo ready: ${photo.name}` : "Photo (optional)"}
          </Text>
          <input
            key={fileKey}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Photo of the waste"
            disabled={pending}
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        {message ? <Banner status="error" title={message} /> : null}
        {saved ? <Banner status="success" title="Saved." /> : null}
        <Button
          label="Save waste"
          variant="primary"
          size="lg"
          isLoading={pending}
          onClick={submit}
        />
      </VStack>
    </Card>
  );
}
