"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DateTimeInput } from "@astryxdesign/core/DateTimeInput";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { cancelAction, markDone, setDue, setOwner } from "./actions";

const NOBODY = "nobody";

/**
 * Everything a manager can do to an open follow-up: take it or clear the owner, move the due time, close it as done
 * (with a note) or cancel it (with a reason). Each write keeps one key until it succeeds, so a retry or a double click
 * adds nothing.
 *
 * The owner comes from the people the backend says may own one; "Nobody" clears it.
 */
export function ActionControls({
  venueId,
  actionId,
  owners,
  ownerUserId,
  due,
}: {
  venueId: string;
  actionId: string;
  owners: { id: string; name: string }[];
  ownerUserId: string | null;
  /** The due time as the venue's wall clock, `2026-11-17T09:00`. */
  due: string;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [pending, start] = useTransition();
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  const [pick, setPick] = useState(ownerUserId ?? NOBODY);
  const [dueInput, setDueInput] = useState(due);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const keyFor = (sig: string) => {
    if (keyRef.current?.sig !== sig)
      keyRef.current = { sig, key: crypto.randomUUID() };
    return keyRef.current.key;
  };

  const run = (
    send: () => Promise<
      { ok: true } | { ok: false; error: { message: string } }
    >,
    saved: string | null,
  ) =>
    start(
      guard(async () => {
        setMessage(null);
        setNotice(null);
        const result = await send();
        if (!result.ok) return setMessage(result.error.message);
        keyRef.current = null;
        setNotice(saved);
        router.refresh();
      }),
    );

  const ids = { venueId, actionId };
  const changeOwner = () => {
    if (pick === (ownerUserId ?? NOBODY))
      return setMessage("Choose a different owner first.");
    owner(pick === NOBODY ? null : pick);
  };
  const owner = (to: string | null) =>
    run(
      () =>
        setOwner({
          ...ids,
          ownerUserId: to,
          key: keyFor(`owner:${to ?? "none"}`),
        }),
      to ? "The owner was changed." : "The owner was cleared.",
    );

  const changeDue = () => {
    if (dueInput === due) return setMessage("Choose a new due time first.");
    run(
      () => setDue({ ...ids, due: dueInput, key: keyFor(`due:${dueInput}`) }),
      "The due time was changed.",
    );
  };

  const done = () => {
    if (!note.trim())
      return setMessage("Write what was done before marking it done.");
    run(
      () => markDone({ ...ids, note, key: keyFor(`done:${note}`) }),
      "Marked done.",
    );
  };

  const cancel = () => {
    if (!reason.trim()) return setMessage("Write why it is being cancelled.");
    run(
      () => cancelAction({ ...ids, reason, key: keyFor(`cancel:${reason}`) }),
      "Cancelled.",
    );
  };

  return (
    <VStack gap={4} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {notice ? <Banner status="success" title={notice} /> : null}
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Owner and due time</Heading>
          <Selector
            label="Owner"
            value={pick}
            options={[
              { value: NOBODY, label: "Nobody" },
              ...owners.map((o) => ({ value: o.id, label: o.name })),
            ]}
            onChange={setPick}
          />
          <HStack gap={2}>
            <Button
              label="Change the owner"
              isLoading={pending}
              onClick={changeOwner}
            />
          </HStack>
          <DateTimeInput
            label="Due (venue time)"
            value={dueInput as never}
            onChange={(v) => v && setDueInput(v)}
          />
          <HStack gap={2}>
            <Button
              label="Change the due time"
              isLoading={pending}
              onClick={changeDue}
            />
          </HStack>
        </VStack>
      </Card>
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Mark done</Heading>
          <Text type="supporting" color="secondary">
            Say what was done. A closed follow-up cannot be opened again.
          </Text>
          <TextArea
            label="What was done"
            maxLength={1000}
            value={note}
            onChange={(v) => setNote(v)}
          />
          <HStack gap={2}>
            <Button
              label="Mark done"
              variant="primary"
              isLoading={pending}
              onClick={done}
            />
          </HStack>
        </VStack>
      </Card>
      <Card padding={4}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Cancel</Heading>
          <Text type="supporting" color="secondary">
            Use this when nothing needs doing. Say why.
          </Text>
          <TextArea
            label="Why it is cancelled"
            maxLength={1000}
            value={reason}
            onChange={(v) => setReason(v)}
          />
          <HStack gap={2}>
            <Button
              label="Cancel this follow-up"
              isDisabled={pending}
              onClick={cancel}
            />
          </HStack>
        </VStack>
      </Card>
    </VStack>
  );
}
