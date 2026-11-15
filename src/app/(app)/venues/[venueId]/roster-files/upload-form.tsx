"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useGuard } from "../bills/guarded";

type Answer = {
  document_id: string;
  label: string;
  help: string;
  status: string;
  shifts_read: number;
  reasons: string[];
};

/** Pick a roster CSV and send it. The answer says at once whether it is done or needs a check. */
export function UploadForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const guard = useGuard();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

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
            `/venues/${venueId}/roster-files/upload`,
            { method: "POST", body: form, credentials: "same-origin" },
          );
          const body = (await response.json().catch(() => null)) as
            | (Answer & { error?: { message?: string } })
            | null;
          if (!response.ok || !body?.document_id) {
            setMessage(
              body?.error?.message ??
                "The file did not upload. Please try again.",
            );
            return;
          }
          setKey(crypto.randomUUID());
          setAnswer(body);
          setFile(null);
          if (input.current) input.current.value = "";
          router.refresh();
        } catch {
          setMessage("The file did not upload. Check your connection.");
        }
      }),
    );

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {answer ? (
        <Banner
          status={answer.status === "needs_check" ? "warning" : "success"}
          title={`${answer.label}: ${answer.shifts_read} shifts read`}
          description={answer.help}
        />
      ) : null}
      {answer?.reasons.map((r) => (
        <Text key={r} type="supporting" color="secondary">
          {r}
        </Text>
      ))}
      {answer ? (
        <Link href={`/venues/${venueId}/roster-files/${answer.document_id}`}>
          Look at this file
        </Link>
      ) : null}
      <label>
        <Text type="label">Roster (CSV)</Text>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        label="Upload"
        variant="primary"
        size="lg"
        isLoading={pending}
        isDisabled={!file}
        onClick={send}
      />
    </VStack>
  );
}
