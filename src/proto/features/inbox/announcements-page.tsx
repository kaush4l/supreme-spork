"use client";

import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useEffect, useRef, useState } from "react";
import { simulateMutation } from "../../adapter";
import { DeniedPanel } from "../../components/denied-panel";
import { type FeedbackStatus, StatusFeedback } from "../../components/section";
import { can, personas } from "../../fixtures/personas";
import { pathFor } from "../../state/nav";
import { useProto, useProtoSlice } from "../../state/store";
import type { PersonaId } from "../../types";

interface Sent {
  id: string;
  title: string;
  requiresAck: boolean;
  at: string;
}

const SEED: Sent[] = [
  {
    id: "s-1",
    title: "Christmas trading hours",
    requiresAck: true,
    at: "12 Nov, 9:00 am",
  },
  {
    id: "s-2",
    title: "Car park closed Thursday",
    requiresAck: false,
    at: "9 Nov, 4:15 pm",
  },
];

export function AnnouncementsPage({ personaId }: { personaId: PersonaId }) {
  const persona = personas[personaId];
  const p = useProto();
  const [sent, setSent] = useProtoSlice<Sent[] | null>(
    `announce.sent.${p.venueId}`,
    null,
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ack, setAck] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [fb, setFb] = useState<{ status: FeedbackStatus; message?: string }>({
    status: "idle",
  });
  const seen = useRef(new Set<string>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset clears the duplicate guard and the draft
  useEffect(() => {
    seen.current = new Set();
    setTitle("");
    setBody("");
    setAck(false);
    setFb({ status: "idle" });
  }, [p.resetCount]);

  if (!can(persona, "announcements.compose")) {
    return (
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Announcements</Heading>
        <DeniedPanel
          title="You cannot write announcements"
          message="Your role does not include announcement rights. You can still read announcements in your Inbox."
          recoveryHref={pathFor(personaId, "inbox")}
          recoveryLabel="Go to Inbox"
        />
      </VStack>
    );
  }

  const list = sent ?? SEED;
  const publish = () => {
    if (!title.trim() || !body.trim()) {
      setFieldError("Add a title and a message before publishing.");
      return;
    }
    setFieldError(null);
    const key = `publish:${title.trim()}:${body.trim()}:${ack}:${list.length}`;
    const r = simulateMutation(
      () => {
        setSent((prev) => [
          {
            id: `s-${(prev ?? SEED).length + 1}`,
            title: title.trim(),
            requiresAck: ack,
            at: "17 Nov, 10:30 am",
          },
          ...(prev ?? SEED),
        ]);
      },
      { scenario: p.scenario, key, seen: seen.current },
    );
    if (r.status === "duplicate") return;
    if (r.status === "success") {
      setFb({
        status: "success",
        message:
          "Published (simulated). Nobody was notified; recipients' Inboxes are not changed in the prototype.",
      });
      setTitle("");
      setBody("");
      setAck(false);
      return;
    }
    seen.current.delete(key);
    setFb(
      r.status === "failure"
        ? {
            status: "error",
            message: `${r.message} Your text is kept; try again.`,
          }
        : {
            status: "pending",
            message:
              "Slow or loading scenario: not sent. Your text is kept; try again with the Default scenario.",
          },
    );
  };

  return (
    <VStack gap={4} hAlign="stretch" maxWidth={640}>
      <VStack gap={1} hAlign="stretch">
        <Heading level={2}>Announcements</Heading>
        <Text type="supporting">
          Team · simulated publishing, nothing is sent
        </Text>
      </VStack>
      <VStack
        gap={2}
        hAlign="stretch"
        as="section"
        aria-label="Write an announcement"
      >
        <Heading level={3}>Write an announcement</Heading>
        <TextInput
          label="Title"
          value={title}
          onChange={(v) => setTitle(v)}
          isRequired
          status={
            fieldError && !title.trim()
              ? { type: "error", message: "Title is required" }
              : undefined
          }
        />
        <TextArea
          label="Message"
          value={body}
          onChange={(v) => setBody(v)}
          isRequired
          rows={4}
          status={
            fieldError && !body.trim()
              ? { type: "error", message: "Message is required" }
              : undefined
          }
        />
        <Switch
          label="Ask people to acknowledge"
          description="Recipients get a separate Acknowledge button. Reading alone does not count."
          value={ack}
          onChange={setAck}
        />
        {fieldError && (
          <Text role="alert" weight="semibold">
            {fieldError}
          </Text>
        )}
        <StatusFeedback
          status={fb.status}
          message={fb.message}
          onDismiss={() => setFb({ status: "idle" })}
        />
        <HStack gap={2}>
          <Button
            label="Publish (simulated)"
            variant="primary"
            onClick={publish}
            style={{ minBlockSize: "2.75rem" }}
          />
        </HStack>
      </VStack>
      <VStack
        gap={2}
        hAlign="stretch"
        as="section"
        aria-label="Sent announcements"
      >
        <Heading level={3}>{`Sent announcements (${list.length})`}</Heading>
        <VStack gap={2} hAlign="stretch" as="ul" padding={0}>
          {list.map((s) => (
            <VStack
              key={s.id}
              gap={0}
              hAlign="stretch"
              as="li"
              style={{ listStyle: "none" }}
            >
              <Text weight="semibold">{s.title}</Text>
              <Text type="supporting">{`${s.at} · ${s.requiresAck ? "Acknowledgement requested" : "No acknowledgement needed"}`}</Text>
            </VStack>
          ))}
        </VStack>
      </VStack>
    </VStack>
  );
}
