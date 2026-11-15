"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ListItem } from "@/server/data/lists";
import { rangeWords } from "../words";
import type { AnswerSaved } from "./answer-input";
import { uploadPhoto } from "./resize-image";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export type AnswerFn = (input: {
  venueId: string;
  listId: string;
  itemKey: string;
  key: string;
  ticked?: boolean;
  number?: number;
  note?: string;
  photoDocumentId?: string;
}) => Promise<Result<AnswerSaved>>;

export type NotApplicableFn = (input: {
  venueId: string;
  listId: string;
  itemKey: string;
  notApplicable: boolean;
  reason?: string;
}) => Promise<Result<{ done: boolean }>>;

type Props = {
  venueId: string;
  listId: string;
  item: ListItem;
  canEdit: boolean;
  answeredLabel: string | null;
  answer: AnswerFn;
  notApplicable?: NotApplicableFn;
};

/**
 * One item. Each save uses a key made for that exact content: the same content retried reuses the key (so a dropped
 * connection adds nothing twice), changed content gets a new one, and a success clears it.
 */
export function ItemCard({
  venueId,
  listId,
  item,
  canEdit,
  answeredLabel,
  answer,
  notApplicable,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ticked, setTicked] = useState(item.answer?.ticked === true);
  const [num, setNum] = useState<number | null>(item.answer?.number ?? null);
  const [note, setNote] = useState(item.answer?.note ?? "");
  const [photoUrl, setPhotoUrl] = useState(item.answer?.photo_url ?? null);
  const [outside, setOutside] = useState(item.answer?.out_of_range === true);
  const [naOpen, setNaOpen] = useState(false);
  const [reason, setReason] = useState("");
  const keyRef = useRef<{ sig: string; key: string } | null>(null);

  const keyFor = (sig: string) => {
    if (keyRef.current?.sig !== sig)
      keyRef.current = { sig, key: crypto.randomUUID() };
    return keyRef.current.key;
  };

  const save = (
    fields: {
      ticked?: boolean;
      number?: number;
      note?: string;
      photoDocumentId?: string;
    },
    onFail?: () => void,
  ) =>
    start(async () => {
      setMessage(null);
      const result = await answer({
        venueId,
        listId,
        itemKey: item.item_key,
        key: keyFor(JSON.stringify(fields)),
        ...fields,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        onFail?.();
        return;
      }
      keyRef.current = null;
      setOutside(result.data.outOfRange);
      if (result.data.photoUrl) setPhotoUrl(result.data.photoUrl);
      router.refresh();
    });

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      setMessage(null);
      try {
        const id = await uploadPhoto(venueId, listId, file);
        const result = await answer({
          venueId,
          listId,
          itemKey: item.item_key,
          key: keyFor(`photo:${id}`),
          photoDocumentId: id,
        });
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        keyRef.current = null;
        if (result.data.photoUrl) setPhotoUrl(result.data.photoUrl);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : "The photo did not upload. Please try again.",
        );
      }
    });
  };

  const toggleNa = (on: boolean) =>
    start(async () => {
      if (!notApplicable) return;
      setMessage(null);
      const result = await notApplicable({
        venueId,
        listId,
        itemKey: item.item_key,
        notApplicable: on,
        reason: on ? reason.trim() : undefined,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setNaOpen(false);
      setReason("");
      router.refresh();
    });

  const range = rangeWords(item.min_value, item.max_value);
  const disabled = !canEdit || pending;

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <HStack gap={2} vAlign="center">
          <Text type="large">{item.label}</Text>
          {item.required ? <Badge label="Required" variant="neutral" /> : null}
        </HStack>
        {item.instruction ? (
          <Text type="supporting" color="secondary">
            {item.instruction}
          </Text>
        ) : null}

        {item.not_applicable ? (
          <VStack gap={2} hAlign="start">
            <Text type="body">
              Not applicable
              {item.not_applicable_reason
                ? `: ${item.not_applicable_reason}`
                : "."}
            </Text>
            {canEdit && notApplicable ? (
              <Button
                label="Undo, this applies"
                isLoading={pending}
                onClick={() => toggleNa(false)}
              />
            ) : null}
          </VStack>
        ) : (
          <>
            {item.kind === "tick" ? (
              <Switch
                label={ticked ? "Done" : "Not done yet"}
                value={ticked}
                isDisabled={disabled}
                isLoading={pending}
                onChange={(on) => {
                  const before = ticked;
                  setTicked(on);
                  save({ ticked: on }, () => setTicked(before));
                }}
              />
            ) : null}

            {item.kind === "number" ? (
              <VStack gap={2} hAlign="stretch">
                <NumberInput
                  label="Reading"
                  size="lg"
                  value={num}
                  isDisabled={disabled}
                  description={range ? `Expected: ${range}` : undefined}
                  onChange={(v) => setNum(v)}
                />
                <Button
                  label="Save reading"
                  size="lg"
                  variant="primary"
                  isLoading={pending}
                  isDisabled={!canEdit || num === null}
                  onClick={() => num !== null && save({ number: num })}
                />
                {outside ? (
                  <Banner
                    status="warning"
                    title={`Outside ${range ?? "the expected range"}, tell your manager`}
                    description="Your reading is saved."
                  />
                ) : null}
              </VStack>
            ) : null}

            {item.kind === "note" ? (
              <VStack gap={2} hAlign="stretch">
                <TextArea
                  label="Note"
                  value={note}
                  maxLength={1000}
                  isDisabled={disabled}
                  onChange={(v) => setNote(v)}
                />
                <Button
                  label="Save note"
                  size="lg"
                  variant="primary"
                  isLoading={pending}
                  isDisabled={!canEdit || note.trim() === ""}
                  onClick={() => save({ note: note.trim() })}
                />
              </VStack>
            ) : null}

            {item.kind === "photo" ? (
              <VStack gap={2} hAlign="start">
                {photoUrl ? (
                  <Thumbnail src={photoUrl} alt={`Photo for ${item.label}`} />
                ) : null}
                {canEdit ? (
                  <label>
                    <Text type="label">
                      {pending
                        ? "Uploading..."
                        : photoUrl
                          ? "Take or choose a new photo"
                          : "Take or choose a photo"}
                    </Text>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={pending}
                      onChange={(e) => {
                        onPhoto(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : null}
              </VStack>
            ) : null}

            {item.kind !== "note" && item.answer?.note ? (
              <Text type="supporting" color="secondary">
                Note: {item.answer.note}
              </Text>
            ) : null}
          </>
        )}

        {message ? <Banner status="error" title={message} /> : null}

        {answeredLabel ? (
          <Text type="supporting" color="secondary">
            {answeredLabel}
          </Text>
        ) : null}

        {canEdit && notApplicable && !item.not_applicable ? (
          naOpen ? (
            <VStack gap={2} hAlign="stretch">
              <TextInput
                label="Why does this not apply?"
                value={reason}
                onChange={(v) => setReason(v)}
              />
              <HStack gap={2}>
                <Button
                  label="Mark not applicable"
                  isLoading={pending}
                  isDisabled={reason.trim() === ""}
                  onClick={() => toggleNa(true)}
                />
                <Button label="Cancel" onClick={() => setNaOpen(false)} />
              </HStack>
            </VStack>
          ) : (
            <Button
              label="Not applicable"
              variant="ghost"
              onClick={() => setNaOpen(true)}
            />
          )
        ) : null}
      </VStack>
    </Card>
  );
}
