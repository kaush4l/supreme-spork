"use client";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  endEmployment,
  inviteStaff,
  resetSecondFactor,
  restoreEmployment,
} from "./actions";
import { PersonForm } from "./person-form";

export type Person = {
  id: string;
  name: string;
  email: string | null;
  positions: string[];
  active: boolean;
  hasLogin: boolean;
  rateLabel: string | null;
  rateCents: number | null;
  endedLabel: string | null;
  userId: string | null;
};

/**
 * One person: who they are, whether they can sign in, and the buttons the caller's rights allow. Each write has its
 * own key, replaced only after it worked.
 */
export function PersonCard({
  venueId,
  person,
  positionNames,
  canPay,
  canEdit,
  canInvite,
  canEnd,
  canResetSecondFactor,
}: {
  venueId: string;
  person: Person;
  positionNames: string[];
  canPay: boolean;
  canEdit: boolean;
  canInvite: boolean;
  canEnd: boolean;
  canResetSecondFactor: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"end" | "reset" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = (
    send: () => Promise<{
      ok: boolean;
      data?: unknown;
      error?: { message: string };
    }>,
    success: string | null,
  ) =>
    start(async () => {
      setMessage(null);
      setNotice(null);
      const result = await send();
      setConfirm(null);
      if (!result.ok) {
        setMessage(result.error?.message ?? "That did not work.");
        return;
      }
      setKey(crypto.randomUUID());
      const waiting = (result.data as { needsApproval?: boolean } | undefined)
        ?.needsApproval;
      setNotice(
        waiting
          ? "Sent for approval. Nothing changes until it is approved."
          : success,
      );
      router.refresh();
    });

  const ids = { venueId, staffId: person.id, key };
  return (
    <Card padding={4}>
      <VStack gap={2} hAlign="stretch">
        <HStack gap={2} wrap="wrap">
          <Text type="body">{person.name}</Text>
          <Badge
            label={person.active ? "Working here" : "Left"}
            variant={person.active ? "success" : "neutral"}
          />
          <Badge
            label={person.hasLogin ? "Can sign in" : "No login yet"}
            variant={person.hasLogin ? "info" : "warning"}
          />
        </HStack>
        <Text type="supporting" color="secondary">
          {person.email ?? "No email yet"}
          {person.positions.length > 0
            ? ` · ${person.positions.join(", ")}`
            : ""}
          {person.rateLabel ? ` · ${person.rateLabel}` : ""}
          {person.endedLabel ? ` · Last day ${person.endedLabel}` : ""}
        </Text>
        {canEdit ? (
          <Link href={`/venues/${venueId}/team/${person.id}`}>
            Certificates and availability
          </Link>
        ) : null}
        {message ? <Banner status="error" title={message} /> : null}
        {notice ? <Banner status="info" title={notice} /> : null}
        <HStack gap={2} wrap="wrap">
          {canEdit ? (
            <Button
              label={editing ? "Close" : "Edit"}
              onClick={() => setEditing((v) => !v)}
            />
          ) : null}
          {canInvite && person.active && !person.hasLogin ? (
            person.email ? (
              <Button
                label="Invite"
                isLoading={pending}
                onClick={() =>
                  run(
                    () => inviteStaff(ids),
                    `We emailed an invite to ${person.email}.`,
                  )
                }
              />
            ) : (
              <Text type="supporting" color="secondary">
                Add an email to invite them.
              </Text>
            )
          ) : null}
          {canEnd && person.active ? (
            <Button
              label="End employment"
              variant="destructive"
              onClick={() => setConfirm("end")}
            />
          ) : null}
          {canEnd && !person.active ? (
            <Button
              label="Restore"
              isLoading={pending}
              onClick={() =>
                run(() => restoreEmployment(ids), "They are back on the team.")
              }
            />
          ) : null}
          {canResetSecondFactor && person.hasLogin && person.userId ? (
            <Button
              label="Reset their second factor"
              onClick={() => setConfirm("reset")}
            />
          ) : null}
        </HStack>
        {editing ? (
          <PersonForm
            venueId={venueId}
            positionNames={positionNames}
            canPay={canPay}
            initial={{
              staffId: person.id,
              name: person.name,
              email: person.email ?? "",
              positions: person.positions,
              rateCents: person.rateCents,
            }}
            onDone={() => setEditing(false)}
          />
        ) : null}
      </VStack>
      <AlertDialog
        isOpen={confirm === "end"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`End ${person.name}'s employment?`}
        description="Their last day is today. Their sign-in keeps working until the end of that day. You can restore them later."
        actionLabel="End employment"
        actionVariant="destructive"
        isActionLoading={pending}
        onAction={() => run(() => endEmployment(ids), "Employment ended.")}
      />
      <AlertDialog
        isOpen={confirm === "reset"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Reset ${person.name}'s second factor?`}
        description="This removes their authenticator app and recovery codes. They sign in with their password and set up a new one. Do this only after they have lost both."
        actionLabel="Reset"
        actionVariant="destructive"
        isActionLoading={pending}
        onAction={() =>
          person.userId
            ? run(
                () =>
                  resetSecondFactor({ venueId, userId: person.userId ?? "" }),
                "Their second factor was removed.",
              )
            : undefined
        }
      />
    </Card>
  );
}
