"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import type { PublishIssue, ShiftRecord } from "../../types";
import { shiftWithDates, weekLabel } from "./dates";
import {
  advisoryOf,
  blockingOf,
  diffDraft,
  hasChanges,
  issuesOf,
  RULE_LABEL,
  type WorkingDraft,
} from "./draft";
import { staffName } from "./staff-picker";

export type PublishStatus = {
  status: "idle" | "pending" | "error";
  message?: string;
};

function describe(s: ShiftRecord): string {
  return `${staffName(s.staffId)}${s.leave ? " (leave)" : ""}, ${s.role}, ${shiftWithDates(s)}`;
}

function IssueRow({
  issue,
  shifts,
}: {
  issue: PublishIssue;
  shifts: Map<string, ShiftRecord>;
}) {
  const s = shifts.get(issue.shiftId);
  const label =
    issue.severity === "blocking"
      ? "Blocking error (must be fixed)"
      : "Advisory (does not stop publishing)";
  return (
    <VStack gap={0.5} hAlign="stretch" as="li">
      <Text weight="semibold">{label}</Text>
      {s && <Text wordBreak="break-word">{describe(s)}</Text>}
      <Text type="supporting" wordBreak="break-word">
        {issue.message}
      </Text>
    </VStack>
  );
}

export function PublishReview({
  open,
  desktop,
  draft,
  publish,
  onPublish,
  onClose,
}: {
  open: boolean;
  desktop: boolean;
  draft: WorkingDraft;
  publish: PublishStatus;
  onPublish: () => void;
  onClose: () => void;
}) {
  const diff = diffDraft(draft);
  const issues = issuesOf(draft);
  const blocking = blockingOf(issues);
  const advisory = advisoryOf(issues);
  const all = new Map(
    [...draft.shifts, ...draft.published].map((s) => [s.id, s]),
  );
  const changes = hasChanges(diff);
  const blocked = blocking.length > 0 || !changes;
  return (
    <Dialog
      isOpen={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      purpose="form"
      variant={desktop ? "standard" : "fullscreen"}
      width={desktop ? 640 : undefined}
      maxHeight={desktop ? "90dvh" : undefined}
    >
      <DialogHeader
        title="Review and publish"
        subtitle={`Week of ${weekLabel(draft.weekStart)}. Published version ${draft.version}.`}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      />
      <VStack gap={4} padding={4} hAlign="stretch">
        <VStack gap={2} hAlign="stretch" as="section" aria-label="Changes">
          <Heading level={3}>Changes since published</Heading>
          {!changes && (
            <Text as="p">
              No changes since the published roster. Nothing to publish.
            </Text>
          )}
          <VStack gap={2} hAlign="stretch" as="ul" aria-label="Change list">
            {diff.added.map((s) => (
              <VStack key={`a${s.id}`} as="li" hAlign="stretch">
                <Text wordBreak="break-word">
                  <Text weight="semibold">Added: </Text>
                  {describe(s)}
                </Text>
              </VStack>
            ))}
            {diff.edited.map((e) => (
              <VStack key={`e${e.after.id}`} as="li" hAlign="stretch">
                <Text wordBreak="break-word">
                  <Text weight="semibold">Edited: </Text>
                  {describe(e.after)}. Was {shiftWithDates(e.before)}
                  {e.before.staffId !== e.after.staffId
                    ? `, ${staffName(e.before.staffId)}`
                    : ""}
                  .
                </Text>
              </VStack>
            ))}
            {diff.removed.map((s) => (
              <VStack key={`r${s.id}`} as="li" hAlign="stretch">
                <Text wordBreak="break-word">
                  <Text weight="semibold">Removed: </Text>
                  {describe(s)}
                </Text>
              </VStack>
            ))}
          </VStack>
          <Text type="supporting" as="p">
            {`${diff.added.length} added, ${diff.edited.length} edited, ${diff.removed.length} removed.`}
          </Text>
        </VStack>

        <VStack
          gap={2}
          hAlign="stretch"
          as="section"
          aria-label="Blocking errors"
        >
          <Heading level={3}>Blocking errors ({blocking.length})</Heading>
          {blocking.length === 0 ? (
            <Text as="p">No blocking errors.</Text>
          ) : (
            <>
              <Banner
                status="error"
                title="Publishing is blocked"
                description="Fix these in the roster, then review again."
                collapsible={false}
              />
              <VStack
                gap={3}
                hAlign="stretch"
                as="ul"
                aria-label="Blocking error list"
              >
                {blocking.map((i) => (
                  <IssueRow key={i.id} issue={i} shifts={all} />
                ))}
              </VStack>
            </>
          )}
        </VStack>

        <VStack
          gap={2}
          hAlign="stretch"
          as="section"
          aria-label="Advisory warnings"
        >
          <Heading level={3}>Advisory warnings ({advisory.length})</Heading>
          {advisory.length === 0 ? (
            <Text as="p">No advisory warnings.</Text>
          ) : (
            <>
              <Text type="supporting" as="p">
                Advisory warnings are for information. They do not stop you
                publishing.
              </Text>
              <VStack
                gap={3}
                hAlign="stretch"
                as="ul"
                aria-label="Advisory warning list"
              >
                {advisory.map((i) => (
                  <IssueRow key={i.id} issue={i} shifts={all} />
                ))}
              </VStack>
            </>
          )}
          <Text type="supporting" as="p">
            {`Rule source: ${RULE_LABEL} (sample data only).`}
          </Text>
        </VStack>

        {publish.status === "error" && (
          <Banner
            status="error"
            title="Publish did not work"
            description={`${publish.message ?? ""} Your changes are still in the draft; try again.`}
            collapsible={false}
          />
        )}
        {publish.status === "pending" && (
          <Banner
            status="info"
            title="Publishing"
            description="Simulated publish in progress."
            collapsible={false}
          />
        )}
        {blocked && (
          <Text type="supporting" as="p">
            {blocking.length > 0
              ? "Publish is disabled until the blocking errors are fixed."
              : "Publish is disabled because there are no changes."}
          </Text>
        )}
        <HStack gap={2} wrap="wrap">
          <Button
            label="Publish roster (simulated)"
            variant="primary"
            isDisabled={blocked}
            isLoading={publish.status === "pending"}
            onClick={onPublish}
          />
          <Button label="Back to roster" onClick={onClose} />
        </HStack>
      </VStack>
    </Dialog>
  );
}
