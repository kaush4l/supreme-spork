"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { useEffect } from "react";
import { DeniedPanel } from "../../components/denied-panel";
import { Section, StatusFeedback } from "../../components/section";
import { venues } from "../../fixtures/venues";
import { pathFor } from "../../state/nav";
import { useProto, useScenarioReady } from "../../state/store";
import type { PersonaId } from "../../types";
import { detailState, parseDetailKey, TAB_LABEL } from "./inbox-logic";
import { useInbox } from "./use-inbox";

const TITLE_ID = "inbox-detail-title";

export function InboxDetail({
  personaId,
  rawId,
}: {
  personaId: PersonaId;
  rawId: string;
}) {
  const api = useInbox(personaId);
  const p = useProto();
  const ready = useScenarioReady();
  const parsed = parseDetailKey(rawId);
  const back = pathFor(personaId, "inbox");
  const item =
    parsed && parsed.venueId === api.venueId
      ? api.byId(parsed.itemId)
      : undefined;
  const state = parsed
    ? detailState(item, parsed.venueId, api.venueId)
    : "missing";
  const { markRead } = api;
  const itemId = item?.id;
  const alreadyRead = item?.read;

  // Mark read once the heading is actually visible (not on list render).
  useEffect(() => {
    if (!ready || !itemId || alreadyRead || p.scenario === "empty") return;
    const el = document.getElementById(TITLE_ID);
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (
        entries.some((e) => e.isIntersecting) &&
        document.visibilityState === "visible"
      ) {
        io.disconnect();
        markRead(itemId);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ready, itemId, alreadyRead, markRead, p.scenario]);

  if (!ready) return <Section title="Notice" status="loading" />;
  if (p.scenario === "denied") {
    return (
      <Section
        title="Notice"
        status="denied"
        message="Your access does not include this notice in the denied scenario."
        recoveryHref={back}
      />
    );
  }
  if (p.scenario === "error") {
    return (
      <Section
        title="Notice"
        status="error"
        message="This notice could not be loaded (simulated)."
        onRetry={api.refresh}
      />
    );
  }

  const backButton = (
    <Button
      label="Back to Inbox"
      href={back}
      variant="secondary"
      style={{ minBlockSize: "2.75rem" }}
    />
  );

  if (state === "wrong-venue" && parsed) {
    const other = venues.find((v) => v.id === parsed.venueId);
    const member = api.persona.venueIds.includes(parsed.venueId);
    return (
      <VStack gap={3} hAlign="stretch">
        <Heading level={2} id={TITLE_ID}>
          This notice is in another venue
        </Heading>
        <Banner
          status="warning"
          collapsible={false}
          title={`This is in ${other?.name ?? "another venue"}`}
          description={`You are viewing ${api.venue?.name ?? "a different venue"}. Nothing is shown from the other venue until you choose to switch. You can also go back to this venue's Inbox.`}
          endContent={
            <HStack gap={2} wrap="wrap">
              {member && (
                <Button
                  label={`Switch to ${other?.name ?? "that venue"}`}
                  variant="primary"
                  onClick={() => p.setVenue(parsed.venueId)}
                />
              )}
              {backButton}
            </HStack>
          }
        />
      </VStack>
    );
  }
  if (state === "missing" || !item) {
    return (
      <VStack gap={3} hAlign="stretch">
        <Heading level={2} id={TITLE_ID}>
          This is no longer available
        </Heading>
        <Banner
          status="info"
          collapsible={false}
          title="This notice could not be found"
          description="It may have been removed. Nothing was changed."
          endContent={backButton}
        />
      </VStack>
    );
  }
  if (state === "removed") {
    return (
      <VStack gap={3} hAlign="stretch">
        <Heading level={2} id={TITLE_ID}>
          {item.title}
        </Heading>
        <Banner
          status="info"
          collapsible={false}
          title="This is no longer available"
          description="The request this notice was about was withdrawn or removed. Last outcome: none recorded. There is nothing to approve or decline."
          endContent={backButton}
        />
      </VStack>
    );
  }
  if (state === "revoked") {
    return (
      <VStack gap={3} hAlign="stretch">
        <Heading level={2} id={TITLE_ID}>
          You no longer have access
        </Heading>
        <Banner
          status="warning"
          collapsible={false}
          title="You no longer have access to the details"
          description={`Summary only: ${item.title}. Ask a manager if you still need this. No actions are available.`}
          endContent={backButton}
        />
        <DeniedPanel
          title="Why you see this"
          message="Your rights for this item were removed after the notice was sent."
          recoveryHref={back}
          recoveryLabel="Back to Inbox"
        />
      </VStack>
    );
  }

  const isAction = item.tab === "action";
  return (
    <VStack gap={3} hAlign="stretch">
      <HStack gap={2} wrap="wrap">
        {backButton}
      </HStack>
      <VStack gap={1} hAlign="stretch">
        <Heading level={2} id={TITLE_ID}>
          {item.title}
        </Heading>
        <Text type="supporting">{`${TAB_LABEL[item.tab]} · ${item.group ?? ""} · ${item.createdAt.slice(0, 10)}`}</Text>
      </VStack>
      <StatusFeedback
        status={api.feedback.status}
        message={api.feedback.message}
        onDismiss={api.dismissFeedback}
      />
      <Text>{item.body}</Text>
      <VStack gap={0} hAlign="stretch" as="section" aria-label="Status">
        <Text weight="semibold">{`Read: ${item.read ? "yes" : "no"}`}</Text>
        {item.requiresAck && (
          <Text weight="semibold">{`Acknowledged: ${item.acknowledged ? "yes" : "no"}`}</Text>
        )}
        {isAction && (
          <Text weight="semibold">{`Resolved: ${item.subjectState === "resolved" ? "yes" : "no"}`}</Text>
        )}
        <Text type="supporting">
          Reading this notice does not acknowledge or resolve anything.
        </Text>
      </VStack>
      {item.outcome && (
        <Banner
          status="info"
          collapsible={false}
          title={item.outcome.text}
          description={`By ${item.outcome.by}. No decision is needed any more. This outcome is kept in your history.`}
        />
      )}
      {isAction && item.subjectState === "open" && (
        <HStack gap={2} wrap="wrap">
          <Button
            label="Approve"
            variant="primary"
            onClick={() => api.decide(item.id, "approved")}
            style={{ minBlockSize: "2.75rem" }}
          />
          <Button
            label="Decline"
            onClick={() => api.decide(item.id, "declined")}
            style={{ minBlockSize: "2.75rem" }}
          />
        </HStack>
      )}
      {item.requiresAck && !item.acknowledged && (
        <Button
          label="Acknowledge"
          variant="primary"
          onClick={() => api.acknowledge(item.id)}
          style={{ minBlockSize: "2.75rem" }}
        />
      )}
      <Text type="supporting">{`Simulated changes applied this session: ${api.log.length}`}</Text>
    </VStack>
  );
}
