"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DateInput } from "@astryxdesign/core/DateInput";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { applyTemplate } from "./actions";

/** Make this template's open shifts from a start date. A week or two weeks start on a Monday; the backend checks. */
export function ApplyCard({
  venueId,
  templateId,
  lengthDays,
}: {
  venueId: string;
  templateId: string;
  lengthDays: number;
}) {
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [start, setStart] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{
    created: number | null;
    start: string;
  } | null>(null);

  const apply = guard(async () => {
    setMessage(null);
    setDone(null);
    if (!start) return setMessage("Choose a start date.");
    setBusy(true);
    const r = await applyTemplate({ venueId, templateId, key, start });
    setBusy(false);
    if (!r.ok) return setMessage(r.error.message);
    setKey(crypto.randomUUID());
    setDone({ created: r.data.created, start });
  });

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Use it on a week</Heading>
        <Text type="supporting" color="secondary">
          This makes open shifts from the template. Shifts already on the roster
          stay.
          {lengthDays > 1 ? " Start on a Monday." : ""}
        </Text>
        {message ? <Banner status="error" title={message} /> : null}
        {done ? (
          <Banner
            status="success"
            title={`Made ${done.created ?? 0} open ${done.created === 1 ? "shift" : "shifts"}.`}
            description={
              lengthDays > 1 ? (
                <Link href={`/venues/${venueId}/roster?week=${done.start}`}>
                  Open that week
                </Link>
              ) : undefined
            }
          />
        ) : null}
        <DateInput
          label="Start date"
          value={(start || undefined) as never}
          onChange={(v) => setStart(v ?? "")}
        />
        <Button
          label="Make the shifts"
          variant="primary"
          isLoading={busy}
          onClick={apply}
        />
      </VStack>
    </Card>
  );
}
