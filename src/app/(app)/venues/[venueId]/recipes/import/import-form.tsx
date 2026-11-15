"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useRef, useState, useTransition } from "react";
import type { ImportAnswer } from "@/server/data/recipes";
import { useGuard } from "../../bills/guarded";

/** Pick a recipes CSV and send it. The answer says what was loaded and which ingredients were skipped. */
export function ImportForm({ venueId }: { venueId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [answer, setAnswer] = useState<ImportAnswer | null>(null);

  const send = () =>
    start(
      guard(async () => {
        if (!file) return;
        setMessage(null);
        setAnswer(null);
        const form = new FormData();
        form.append("file", file, file.name);
        form.append("key", key);
        try {
          const response = await fetch(
            `/venues/${venueId}/recipes/import/upload`,
            { method: "POST", body: form, credentials: "same-origin" },
          );
          const body = (await response.json().catch(() => null)) as
            | (Partial<ImportAnswer> & { error?: { message?: string } })
            | null;
          if (!response.ok || body?.added === undefined) {
            setMessage(
              body?.error?.message ??
                "The file did not upload. Please try again.",
            );
            return;
          }
          setKey(crypto.randomUUID());
          setAnswer(body as ImportAnswer);
          setFile(null);
          if (input.current) input.current.value = "";
        } catch {
          setMessage("The file did not upload. Check your connection.");
        }
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {answer ? (
        <VStack gap={2} hAlign="stretch">
          <Banner
            status={answer.lines_skipped > 0 ? "warning" : "success"}
            title="The file was read"
            description={`${answer.added} lines added, ${answer.changed} changed, ${answer.unchanged} unchanged, ${answer.lines_skipped} skipped.`}
          />
          {answer.ingredients_not_found.length > 0 ? (
            <VStack gap={1} hAlign="stretch">
              <Text type="label">Ingredients that were skipped</Text>
              <Text type="supporting" color="secondary">
                No docket has bought these yet. Load the file again once their
                dockets are booked.
              </Text>
              {answer.ingredients_not_found.map((name) => (
                <Text key={name} type="body">
                  {name}
                </Text>
              ))}
            </VStack>
          ) : null}
        </VStack>
      ) : null}
      <label>
        <Text type="label">Recipes (CSV)</Text>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        label="Import"
        variant="primary"
        size="lg"
        isLoading={pending}
        isDisabled={!file}
        onClick={send}
      />
    </VStack>
  );
}
