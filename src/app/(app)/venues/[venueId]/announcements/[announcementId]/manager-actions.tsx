"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGuard } from "../../bills/guarded";
import { remindAnnouncement, withdrawAnnouncement } from "../actions";

/**
 * Remind the people who have not read it, or withdraw it (after a plain question). Each write has a key made when the
 * buttons are drawn and replaced only after a success, and a guarded click. The backend's own sentence is shown when it
 * says no (for example that people were already reminded today).
 */
export function ManagerActions({
  venueId,
  announcementId,
  withdrawn,
}: {
  venueId: string;
  announcementId: string;
  withdrawn: boolean;
}) {
  const router = useRouter();
  const guard = useGuard();
  const [remindKey, setRemindKey] = useState(() => crypto.randomUUID());
  const [withdrawKey, setWithdrawKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState<"remind" | "withdraw" | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const remind = guard(async () => {
    setBusy("remind");
    setMessage(null);
    setDone(null);
    const r = await remindAnnouncement({
      venueId,
      announcementId,
      key: remindKey,
    });
    setBusy(null);
    if (!r.ok) return setMessage(r.error.message);
    setRemindKey(crypto.randomUUID());
    setDone(
      r.data.reminded === 1
        ? "1 person was reminded."
        : `${r.data.reminded} people were reminded.`,
    );
    router.refresh();
  });

  const withdraw = guard(async () => {
    setBusy("withdraw");
    setMessage(null);
    setDone(null);
    const r = await withdrawAnnouncement({
      venueId,
      announcementId,
      key: withdrawKey,
    });
    setBusy(null);
    if (!r.ok) return setMessage(r.error.message);
    setWithdrawKey(crypto.randomUUID());
    setAsking(false);
    router.refresh();
  });

  if (withdrawn) return null;
  return (
    <VStack gap={2} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {done ? <Banner status="success" title={done} /> : null}
      <HStack gap={2} wrap="wrap">
        <Button
          label="Remind people who have not read it"
          variant="secondary"
          isLoading={busy === "remind"}
          onClick={remind}
        />
        {asking ? null : (
          <Button
            label="Withdraw"
            variant="secondary"
            onClick={() => setAsking(true)}
          />
        )}
      </HStack>
      {asking ? (
        <Banner
          status="warning"
          title="Withdraw this announcement?"
          description="Staff will see that it was withdrawn, without the text. You cannot undo this."
        />
      ) : null}
      {asking ? (
        <HStack gap={2}>
          <Button
            label="Yes, withdraw it"
            variant="destructive"
            isLoading={busy === "withdraw"}
            onClick={withdraw}
          />
          <Button
            label="Keep it"
            variant="ghost"
            onClick={() => setAsking(false)}
          />
        </HStack>
      ) : null}
    </VStack>
  );
}
