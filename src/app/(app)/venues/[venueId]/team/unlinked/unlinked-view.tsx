"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { addToTeam } from "./actions";

export type UnlinkedLine = {
  ref: string;
  name: string;
  positions: string[];
  shifts: number;
  rateLabel: string | null;
};

export function UnlinkedView({
  venueId,
  people,
}: {
  venueId: string;
  people: UnlinkedLine[];
}) {
  const router = useRouter();
  const guard = useGuard();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = guard(async (ref?: string) => {
    setMessage(null);
    setNotice(null);
    setBusy(ref ?? "all");
    const result = await addToTeam({ venueId, key, staffRef: ref });
    setBusy(null);
    if (!result.ok) return setMessage(result.error.message);
    setKey(crypto.randomUUID());
    setNotice(
      result.data.created === 1
        ? "Added 1 person to the team."
        : `Added ${result.data.created} people to the team.`,
    );
    router.refresh();
  });

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {notice ? <Banner status="success" title={notice} /> : null}
      {people.length === 0 ? (
        <Text type="supporting" color="secondary">
          Everyone named in a roster file is already on the team.
        </Text>
      ) : (
        <>
          {people.map((p) => (
            <Card key={p.ref} padding={4}>
              <VStack gap={2} hAlign="stretch">
                <Text type="body">{p.name}</Text>
                <Text type="supporting" color="secondary">
                  {p.shifts === 1 ? "1 shift" : `${p.shifts} shifts`}
                  {p.positions.length > 0 ? ` · ${p.positions.join(", ")}` : ""}
                  {p.rateLabel ? ` · ${p.rateLabel}` : ""}
                </Text>
                <Button
                  label="Add to the team"
                  aria-label={`Add ${p.name} to the team`}
                  isLoading={busy === p.ref}
                  isDisabled={busy !== null}
                  onClick={() => add(p.ref)}
                />
              </VStack>
            </Card>
          ))}
          {people.length > 1 ? (
            <Button
              label="Add everyone to the team"
              variant="primary"
              isLoading={busy === "all"}
              isDisabled={busy !== null}
              onClick={() => add()}
            />
          ) : null}
        </>
      )}
    </VStack>
  );
}
