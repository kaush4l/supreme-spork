"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { acceptSuggestions } from "./actions";

export type SuggestionLine = {
  id: string;
  title: string;
  when: string;
  hoursLabel: string | null;
  candidates: { staffId: string; name: string; reasons: string }[];
  skipped: { name: string; reasons: string }[];
};

const NOBODY = "none";

/** Each open shift with the people who could work it, best first, and a choice per shift to accept in one go. */
export function SuggestionList({
  venueId,
  week,
  lines,
}: {
  venueId: string;
  week: string;
  lines: SuggestionLine[];
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    filled: number;
    skipped: { title: string; reason: string }[];
  } | null>(null);

  const chosen = Object.entries(choice).filter(([, v]) => v !== NOBODY);
  const title = (id: string) => lines.find((l) => l.id === id)?.title ?? id;

  const accept = guard(async () => {
    setBusy(true);
    setMessage(null);
    setResult(null);
    const r = await acceptSuggestions({
      venueId,
      key,
      week,
      assignments: chosen.map(([externalId, staffId]) => ({
        externalId,
        staffId,
      })),
    });
    setBusy(false);
    if (!r.ok) return setMessage(r.error.message);
    setKey(crypto.randomUUID());
    setChoice({});
    setResult({
      filled: r.data.filled.length,
      skipped: r.data.skipped.map((s) => ({
        title: title(s.externalId),
        reason: s.reason,
      })),
    });
    router.refresh();
  });

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {result ? (
        <Banner
          status={result.skipped.length > 0 ? "warning" : "success"}
          title={`${result.filled} ${result.filled === 1 ? "shift was" : "shifts were"} filled.`}
          description={
            result.skipped.length > 0
              ? result.skipped.map((s) => `${s.title}: ${s.reason}`).join(" ")
              : undefined
          }
        />
      ) : null}
      {lines.map((l) => (
        <Card key={l.id} padding={4}>
          <VStack gap={2} hAlign="stretch">
            <Text type="body">{l.title}</Text>
            <Text type="supporting" color="secondary">
              {l.when}
              {l.hoursLabel ? ` · ${l.hoursLabel}` : ""}
            </Text>
            {l.candidates.length === 0 ? (
              <Text type="supporting" color="secondary">
                Nobody could work this one.
              </Text>
            ) : (
              <Selector
                label="Who should work it"
                value={choice[l.id] ?? NOBODY}
                options={[
                  { value: NOBODY, label: "Nobody yet" },
                  ...l.candidates.map((c) => ({
                    value: c.staffId,
                    label: c.name,
                    description: c.reasons,
                  })),
                ]}
                onChange={(v) => setChoice((all) => ({ ...all, [l.id]: v }))}
              />
            )}
            {l.skipped.length > 0 ? (
              <Collapsible
                trigger={
                  <Text type="supporting" color="secondary">
                    Left out ({l.skipped.length})
                  </Text>
                }
                defaultIsOpen={false}
              >
                <VStack gap={1} hAlign="stretch">
                  {l.skipped.map((s) => (
                    <Text key={s.name} type="supporting" color="secondary">
                      {s.name}: {s.reasons}
                    </Text>
                  ))}
                </VStack>
              </Collapsible>
            ) : null}
          </VStack>
        </Card>
      ))}
      <Button
        label={
          chosen.length === 0
            ? "Fill chosen shifts"
            : `Fill ${chosen.length} chosen ${chosen.length === 1 ? "shift" : "shifts"}`
        }
        variant="primary"
        isLoading={busy}
        isDisabled={chosen.length === 0}
        onClick={accept}
      />
    </VStack>
  );
}
