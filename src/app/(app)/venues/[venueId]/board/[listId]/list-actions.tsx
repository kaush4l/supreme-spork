"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { finishListAsManager, saveListAsTemplate } from "./actions";

/** Finish the list. If something required is left, the backend's sentence says what; it is shown as it came. */
export function FinishList({
  venueId,
  listId,
}: {
  venueId: string;
  listId: string;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [pending, start] = useTransition();
  const [left, setLeft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [late, setLate] = useState<boolean | null>(null);

  const onFinish = guard(
    () =>
      new Promise<void>((resolve) =>
        start(async () => {
          setLeft(null);
          setProblem(null);
          const result = await finishListAsManager({ venueId, listId });
          if (result.ok) {
            setLate(result.data.late);
            router.refresh();
          } else if (result.error.code === "list_incomplete")
            setLeft(result.error.message);
          else setProblem(result.error.message);
          resolve();
        }),
      ),
  );

  return (
    <VStack gap={2} hAlign="stretch">
      {left ? (
        <Banner status="warning" title="Not finished yet" description={left} />
      ) : null}
      {problem ? <Banner status="error" title={problem} /> : null}
      {late !== null ? (
        <Banner
          status="success"
          title={late ? "Finished, a little late" : "Finished"}
        />
      ) : null}
      <Button
        label="Finish list"
        variant="primary"
        size="lg"
        isLoading={pending}
        onClick={onFinish}
      />
    </VStack>
  );
}

/** Make a new checklist from this list as it now stands, then go to it. */
export function SaveAsTemplate({
  venueId,
  listId,
}: {
  venueId: string;
  listId: string;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const save = guard(
    () =>
      new Promise<void>((resolve) =>
        start(async () => {
          setMessage(null);
          const result = await saveListAsTemplate({
            venueId,
            listId,
            key,
            name: name.trim() || undefined,
          });
          if (result.ok) {
            setKey(crypto.randomUUID());
            router.push(
              `/venues/${venueId}/checklists/${result.data.templateKey}`,
            );
          } else setMessage(result.error.message);
          resolve();
        }),
      ),
  );

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Save as a new template</Heading>
        <Text type="supporting" color="secondary">
          Makes a new checklist from this list as it is now, with the items
          added here and without the ones taken off. The checklist it came from
          is not changed.
        </Text>
        <TextInput
          label="Name for the new checklist"
          value={name}
          onChange={setName}
          description="Leave blank to use the list's name followed by (edited)."
          isOptional
        />
        {message ? <Banner status="error" title={message} /> : null}
        <Button
          label="Save as a new template"
          isLoading={pending}
          onClick={save}
        />
      </VStack>
    </Card>
  );
}
