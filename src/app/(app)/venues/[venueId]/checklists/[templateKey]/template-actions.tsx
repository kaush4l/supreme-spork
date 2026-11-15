"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useGuard } from "../../bills/guarded";
import { duplicateTemplate, retireTemplate } from "../actions";

/** Make a copy, or retire this checklist (asks first, and says what it does). */
export function TemplateActions({
  venueId,
  templateKey,
}: {
  venueId: string;
  templateKey: string;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const copy = guard(
    () =>
      new Promise<void>((resolve) =>
        start(async () => {
          setMessage(null);
          const result = await duplicateTemplate({
            venueId,
            templateKey,
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

  const retire = guard(
    () =>
      new Promise<void>((resolve) =>
        start(async () => {
          setMessage(null);
          const result = await retireTemplate({ venueId, templateKey });
          if (result.ok) router.push(`/venues/${venueId}/checklists`);
          else setMessage(result.error.message);
          resolve();
        }),
      ),
  );

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Copy or retire</Heading>
        <TextInput
          label="Name for the copy"
          value={name}
          onChange={setName}
          description="Leave blank to call it the same name followed by copy."
          isOptional
        />
        <HStack gap={2}>
          <Button label="Make a copy" isLoading={pending} onClick={copy} />
          {asking ? null : (
            <Button
              label="Retire"
              variant="destructive"
              onClick={() => setAsking(true)}
            />
          )}
        </HStack>
        {message ? <Banner status="error" title={message} /> : null}
        {asking ? (
          <Banner
            status="warning"
            title="Retire this checklist?"
            description="No new lists are made from it, and it can no longer be changed or given a rule. Lists already issued from it stay as they are, with their own copy of the items. This cannot be undone here."
          />
        ) : null}
        {asking ? (
          <HStack gap={2}>
            <Button
              label="Yes, retire it"
              variant="destructive"
              isLoading={pending}
              onClick={retire}
            />
            <Button label="No, keep it" onClick={() => setAsking(false)} />
          </HStack>
        ) : null}
      </VStack>
    </Card>
  );
}
