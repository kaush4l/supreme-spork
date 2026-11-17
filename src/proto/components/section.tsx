"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { useAnnounce } from "@astryxdesign/core/hooks";
import { VStack } from "@astryxdesign/core/Layout";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Heading, Text } from "@astryxdesign/core/Text";
import { type ReactNode, useEffect } from "react";
import type { Coverage } from "../types";
import { DeniedPanel } from "./denied-panel";

export type SectionStatus = "ok" | "loading" | "error" | "denied";

export interface SectionProps {
  title: string;
  status: SectionStatus;
  /** Error or denied explanation. */
  message?: string;
  onRetry?: () => void;
  /** Recovery link for the denied state. */
  recoveryHref?: string;
  /** Heading level (default 2). */
  level?: 2 | 3 | 4;
  /** Rows of skeleton while loading (default 3). */
  skeletonRows?: number;
  children?: ReactNode;
}

/**
 * One independently failing section: skeleton while loading, inline error with Retry, denied panel, or the content.
 * A failed section never blanks its siblings.
 */
export function Section({
  title,
  status,
  message,
  onRetry,
  recoveryHref,
  level = 2,
  skeletonRows = 3,
  children,
}: SectionProps) {
  const announce = useAnnounce();
  useEffect(() => {
    if (status === "error") announce(`${title}: could not load`, "assertive");
  }, [status, title, announce]);
  return (
    <VStack gap={2} hAlign="stretch" as="section" aria-label={title}>
      <Heading level={level}>{title}</Heading>
      {status === "loading" && (
        <VStack gap={2} hAlign="stretch" aria-busy="true">
          <Text type="supporting">Loading {title.toLowerCase()}</Text>
          {Array.from({ length: skeletonRows }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative placeholders
            <Skeleton key={`sk-${i}`} height={20} index={i} />
          ))}
        </VStack>
      )}
      {status === "error" && (
        <Banner
          status="error"
          title={`${title} could not be loaded`}
          description={
            message ?? "Something went wrong. Other sections are unaffected."
          }
          collapsible={false}
          endContent={
            onRetry ? <Button label="Retry" onClick={onRetry} /> : undefined
          }
        />
      )}
      {status === "denied" && (
        <DeniedPanel message={message} recoveryHref={recoveryHref} />
      )}
      {status === "ok" && children}
    </VStack>
  );
}

export type FeedbackStatus = "idle" | "pending" | "success" | "error";

/** Inline toast-like feedback for a write: pending, success or error, announced to screen readers. */
export function StatusFeedback({
  status,
  message,
  onDismiss,
}: {
  status: FeedbackStatus;
  message?: string;
  onDismiss?: () => void;
}) {
  const announce = useAnnounce();
  useEffect(() => {
    if (status === "idle" || !message) return;
    announce(message, status === "error" ? "assertive" : "polite");
  }, [status, message, announce]);
  if (status === "idle") return null;
  const map = {
    pending: { s: "info", t: "Working" },
    success: { s: "success", t: "Done" },
    error: { s: "error", t: "Did not work" },
  } as const;
  const m = map[status];
  return (
    <Banner
      status={m.s}
      title={m.t}
      description={message}
      collapsible={false}
      isDismissable={status !== "pending" && !!onDismiss}
      onDismiss={onDismiss}
    />
  );
}

const STATE_WORD: Record<Coverage["state"], string> = {
  complete: "Complete",
  partial: "Partial",
  missing: "Missing",
};

/** "As of" in the venue's own offset: slice the ISO string, never convert it. */
export function formatAsOf(asOf: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(asOf);
  return m ? `${m[1]} ${m[2]}` : asOf;
}

/** Coverage state, period label and as-of. Missing reads "Missing", never 0. State is in words, not colour alone. */
export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  return (
    <Text type="supporting">
      <Text
        weight="semibold"
        color={coverage.state === "complete" ? "secondary" : "primary"}
      >
        {STATE_WORD[coverage.state]}
      </Text>
      {` · ${coverage.periodLabel} · as of ${formatAsOf(coverage.asOf)}`}
      {coverage.note ? ` · ${coverage.note}` : ""}
    </Text>
  );
}
