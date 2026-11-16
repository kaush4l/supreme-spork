"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import {
  CheckboxList,
  CheckboxListItem,
} from "@astryxdesign/core/CheckboxList";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { sendAnnouncement } from "../actions";
import { AUDIENCE_KINDS, type AudienceKind, formProblem } from "../words";

type Choice = { value: string; label: string };

export type AudienceChoices = {
  positions: Choice[];
  groups: Choice[];
  people: Choice[];
};

const PICK_LABEL: Record<Exclude<AudienceKind, "everyone">, string> = {
  positions: "Which positions",
  groups: "Which groups",
  people: "Which people",
};

/**
 * Write and send an announcement. The key is made when the form is drawn and replaced only after it was sent, and the
 * click is guarded, so a double click sends one. The backend works out who is reached and says if nobody is.
 */
export function AnnouncementForm({
  venueId,
  choices,
}: {
  venueId: string;
  choices: AudienceChoices;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<AudienceKind>("everyone");
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // only the kinds that have something to choose from (everyone is always there)
  const kinds = AUDIENCE_KINDS.filter(
    (k) => k.value === "everyone" || choices[k.value].length > 0,
  );

  const send = guard(async () => {
    const problem = formProblem({ title, body, kind, ids });
    if (problem) return setMessage(problem);
    setBusy(true);
    setMessage(null);
    const result = await sendAnnouncement({
      venueId,
      key,
      title,
      body,
      audienceKind: kind,
      audienceIds: kind === "everyone" ? [] : ids,
    });
    if (!result.ok) {
      setBusy(false);
      return setMessage(result.error.message);
    }
    setKey(crypto.randomUUID());
    router.push(`/venues/${venueId}/announcements/${result.data.id}`);
  });

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      <TextInput
        label="Title"
        value={title}
        onChange={setTitle}
        isRequired
        size="lg"
      />
      <TextArea
        label="Message"
        value={body}
        onChange={(v) => setBody(v)}
        isRequired
        maxLength={5000}
      />
      <Selector
        label="Who is it for"
        value={kind}
        options={kinds.map((k) => ({ value: k.value, label: k.label }))}
        onChange={(v) => {
          setKind(v as AudienceKind);
          setIds([]);
        }}
        size="lg"
      />
      {kind === "everyone" ? (
        <Banner
          status="info"
          title="Everyone who works here and has an app login will be told."
        />
      ) : (
        <CheckboxList label={PICK_LABEL[kind]} value={ids} onChange={setIds}>
          {choices[kind].map((c) => (
            <CheckboxListItem key={c.value} value={c.value} label={c.label} />
          ))}
        </CheckboxList>
      )}
      <HStack gap={2}>
        <Button
          label="Send announcement"
          variant="primary"
          size="lg"
          isLoading={busy}
          onClick={send}
        />
      </HStack>
    </VStack>
  );
}
