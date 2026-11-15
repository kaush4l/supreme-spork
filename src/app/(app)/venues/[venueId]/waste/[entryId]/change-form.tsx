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
import { changeWaste, removeWaste } from "../actions";
import { uploadWastePhoto } from "../upload-photo";

type Entry = {
  id: string;
  qty: number;
  unit: string;
  itemKind: string | null;
  reason: string;
  note: string;
};

/** Correct or take back one entry. Only what changed is sent; each action has its own key so a double tap writes once. */
export function ChangeForm({
  venueId,
  entry,
  reasons,
}: {
  venueId: string;
  entry: Entry;
  reasons: { code: string; label: string }[];
}) {
  const router = useRouter();
  const [changeKey, setChangeKey] = useState(() => crypto.randomUUID());
  const [removeKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<number | null>(entry.qty);
  const [reason, setReason] = useState(entry.reason);
  const [note, setNote] = useState(entry.note);
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const unit = entry.itemKind === "menu_item" ? "portions" : entry.unit;

  const save = () =>
    start(async () => {
      setMessage(null);
      setNotice(null);
      if (qty === null || qty <= 0)
        return setMessage("Enter how much was thrown away.");
      const noteChanged = note.trim() !== entry.note;
      if (
        qty === entry.qty &&
        reason === entry.reason &&
        !noteChanged &&
        !photo
      )
        return setNotice("Nothing has changed.");
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
      const result = await changeWaste({
        venueId,
        key: changeKey,
        entryId: entry.id,
        qty: qty !== entry.qty ? qty : undefined,
        reason: reason !== entry.reason ? reason : undefined,
        note: noteChanged ? note.trim() : undefined,
        photoDocumentId,
      });
      if (!result.ok) return setMessage(result.error.message);
      setChangeKey(crypto.randomUUID());
      setPhoto(null);
      setNotice("Saved.");
      // A correction gets a new id: open the new version.
      if (result.data.id !== entry.id)
        router.replace(`/venues/${venueId}/waste/${result.data.id}`);
      else router.refresh();
    });

  const remove = () =>
    start(async () => {
      setMessage(null);
      const result = await removeWaste({
        venueId,
        key: removeKey,
        entryId: entry.id,
      });
      if (!result.ok) return setMessage(result.error.message);
      router.replace(`/venues/${venueId}/waste`);
    });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Correct this entry</Heading>
        <NumberInput
          label={`How much (${unit})`}
          size="lg"
          value={qty}
          onChange={setQty}
          min={0}
        />
        <Selector
          label="Why"
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
            {photo
              ? `New photo ready: ${photo.name}`
              : "Replace the photo (optional)"}
          </Text>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="New photo"
            disabled={pending}
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        {message ? <Banner status="error" title={message} /> : null}
        {notice ? <Banner status="success" title={notice} /> : null}
        <Button
          label="Save changes"
          variant="primary"
          size="lg"
          isLoading={pending}
          onClick={save}
        />
        {confirming ? (
          <VStack gap={2} hAlign="stretch">
            <Text type="body">
              Take this entry back? It will leave the report.
            </Text>
            <Button
              label="Yes, remove it"
              variant="destructive"
              isLoading={pending}
              onClick={remove}
            />
            <Button label="Keep it" onClick={() => setConfirming(false)} />
          </VStack>
        ) : (
          <Button label="Remove entry" onClick={() => setConfirming(true)} />
        )}
      </VStack>
    </Card>
  );
}
