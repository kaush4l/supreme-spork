"use client";

import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRef, useState } from "react";
import { simulateMutation } from "../../adapter";
import type { FeedbackStatus } from "../../components/section";
import { Section, StatusFeedback } from "../../components/section";
import { formatDate } from "../../fixtures/time";
import {
  useProto,
  useScenarioDelay,
  useScenarioReady,
} from "../../state/store";
import { armTapGuard } from "../../state/tap-guard";
import type { DocketStatus, PersonaId } from "../../types";
import {
  canReview,
  formatCents,
  overrideKey,
  queueHref,
  STATUS_LABEL,
} from "./queue-state";
import { useAccess } from "./use-access";
import { useDocketData } from "./use-docket-data";

type Action = "approve" | "reject";

export function DocketDetail({
  personaId,
  id,
}: {
  personaId: PersonaId;
  id: string;
}) {
  const access = useAccess(personaId);
  const data = useDocketData();
  const { scenario } = useProto();
  const ready = useScenarioReady();
  const delay = useScenarioDelay();
  const [note, setNote] = useState("");
  const [fb, setFb] = useState<{ status: FeedbackStatus; message?: string }>({
    status: "idle",
  });
  const inFlight = useRef(false);
  const seen = useRef(new Set<string>());
  const nonce = useRef(0);

  const canRead =
    access.has("money.dockets.read") || access.has("money.dockets.review");
  const reviewer = access.has("money.dockets.review");
  const backHref = queueHref(personaId, data.ctx.qs);

  if (!access.moneyRoute || !canRead) {
    return (
      <Section
        title="Docket"
        status="denied"
        message="Your access does not include docket review. Staff upload dockets from Today."
        recoveryHref={access.recoveryHref}
      />
    );
  }

  const docket = data.all.find((d) => d.id === id);
  const key = docket ? overrideKey(docket.venueId, docket.id) : "";
  const pending = fb.status === "pending";

  const review = async (action: Action) => {
    if (!docket || inFlight.current) return; // duplicate click while a decision is in flight
    inFlight.current = true;
    armTapGuard(); // swallow a double tap that would hit the bottom nav (see state/tap-guard.ts)
    setFb({
      status: "pending",
      message: `${action === "approve" ? "Approving" : "Rejecting"} ${docket.id}`,
    });
    const mk = `${key}:${action}:${nonce.current}`;
    const run = (): DocketStatus =>
      action === "approve" ? "approved" : "rejected";
    let r = simulateMutation(run, { scenario, key: mk, seen: seen.current });
    if (r.status === "pending") {
      await delay();
      r = simulateMutation(run, {
        scenario: "default",
        key: `${mk}:after-wait`,
        seen: seen.current,
      });
    }
    nonce.current += 1;
    inFlight.current = false;
    if (r.status === "success") {
      data.setOverrides((prev) => ({ ...prev, [key]: r.value }));
      data.setChanges((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
      setNote("");
      setFb({
        status: "success",
        message: `${docket.id} ${r.value}. The queue shows the new status.`,
      });
    } else if (r.status === "failure") {
      setFb({
        status: "error",
        message: `${r.message} Your note is kept; try again.`,
      });
    } else {
      setFb({ status: "idle" });
    }
  };

  const sectionStatus =
    scenario === "denied" ? "denied" : ready ? "ok" : "loading";

  return (
    <VStack gap={3} hAlign="stretch">
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button
          label="Back to queue"
          href={backHref}
          variant="secondary"
          style={{ minBlockSize: "2.75rem" }}
        />
        {!reviewer && (
          <Text weight="semibold">
            Read-only: you can view this docket but not approve or reject it.
          </Text>
        )}
      </HStack>
      <Section
        title={docket ? `Docket ${docket.id}` : "Docket"}
        status={sectionStatus}
        recoveryHref={access.recoveryHref}
      >
        {!docket ? (
          <VStack gap={2} hAlign="start">
            <Text weight="semibold">
              Docket {id} was not found in the current sample data.
            </Text>
            <Text type="supporting">
              It may be outside the selected fixture dataset size or venue.
            </Text>
            <Button label="Back to queue" href={backHref} variant="primary" />
          </VStack>
        ) : (
          <VStack gap={3} hAlign="stretch">
            <VStack
              gap={1}
              padding={4}
              hAlign="center"
              vAlign="center"
              role="img"
              aria-label={`Placeholder image area: ${docket.imageLabel}`}
              style={{
                border: "1px dashed var(--color-border)",
                minBlockSize: "12rem",
              }}
            >
              <Text weight="semibold">Synthetic docket image</Text>
              <Text type="supporting">{docket.imageLabel}</Text>
              <Text type="supporting">
                Placeholder only; no real image is stored or sent.
              </Text>
            </VStack>
            <VStack gap={1} hAlign="start" as="dl">
              <Text>Supplier: {docket.supplier}</Text>
              <Text>Date: {formatDate(docket.date)}</Text>
              <Text>Total: {formatCents(docket.totalCents)}</Text>
              <Text>Uploaded by: {docket.uploadedBy}</Text>
              <Text weight="semibold">
                Status: {STATUS_LABEL[docket.status]}
              </Text>
              <Text type="supporting">
                Review changes recorded for this docket:{" "}
                {data.changes[key] ?? 0}
              </Text>
            </VStack>
            <StatusFeedback
              status={fb.status}
              message={fb.message}
              onDismiss={() => setFb({ status: "idle" })}
            />
            {reviewer && canReview(docket.status) && (
              <VStack gap={2} hAlign="stretch">
                <Heading level={3}>Review</Heading>
                <TextInput
                  label="Review note (optional)"
                  value={note}
                  onChange={setNote}
                  isDisabled={pending}
                />
                <HStack gap={2} wrap="wrap">
                  <Button
                    label="Approve"
                    variant="primary"
                    isDisabled={pending}
                    onClick={() => review("approve")}
                    style={{ minBlockSize: "2.75rem" }}
                  />
                  <Button
                    label="Reject"
                    variant="secondary"
                    isDisabled={pending}
                    onClick={() => review("reject")}
                    style={{ minBlockSize: "2.75rem" }}
                  />
                </HStack>
              </VStack>
            )}
            {reviewer && !canReview(docket.status) && (
              <Text type="supporting">
                This docket is {STATUS_LABEL[docket.status].toLowerCase()}; no
                further review is needed.
              </Text>
            )}
          </VStack>
        )}
      </Section>
    </VStack>
  );
}
