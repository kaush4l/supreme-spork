"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Item } from "@astryxdesign/core/Item";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Heading, Text } from "@astryxdesign/core/Text";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Section, StatusFeedback } from "../../components/section";
import { can } from "../../fixtures/personas";
import { pathFor } from "../../state/nav";
import { useProto, useProtoSlice, useScenarioReady } from "../../state/store";
import type { InboxItem, InboxTab, PersonaId } from "../../types";
import {
  applyScope,
  changeTab,
  changeUnreadOnly,
  countsFor,
  detailKey,
  findDecisionItem,
  groupItems,
  INITIAL_UI,
  type InboxUi,
  loadFeed,
  loadMore,
  parseInboxParams,
  scenarioCandidates,
  TAB_LABEL,
  TABS,
} from "./inbox-logic";
import { type InboxApi, useInbox } from "./use-inbox";

const PANEL_ID = "inbox-panel";

/** Restores scroll once after the page's saved state has hydrated; saves scroll while the user moves. */
function useScrollRestore(
  scroll: number,
  save: (y: number) => void,
  ready: boolean,
) {
  const target = useRef(scroll);
  target.current = scroll;
  const restoring = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!ready) return;
    restoring.current = true;
    let tries = 0;
    const stop = () => {
      restoring.current = false;
      window.clearInterval(timer);
    };
    const timer = window.setInterval(() => {
      tries++;
      const y = target.current;
      if (y > 0) {
        window.scrollTo(0, y);
        if (Math.abs(window.scrollY - y) < 2) return stop();
      }
      if (tries > 30) stop();
    }, 50);
    const onUser = () => stop();
    window.addEventListener("wheel", onUser, { passive: true });
    window.addEventListener("touchstart", onUser, { passive: true });
    window.addEventListener("keydown", onUser);
    let raf = 0;
    const onScroll = () => {
      if (restoring.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => saveRef.current(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onUser);
      window.removeEventListener("touchstart", onUser);
      window.removeEventListener("keydown", onUser);
      window.removeEventListener("scroll", onScroll);
    };
  }, [ready]);
}

function statusText(it: InboxItem, partial: boolean): string {
  if (it.tab !== "action") return "";
  if (it.subjectState === "resolved") return it.outcome?.text ?? "Resolved";
  if (it.subjectState === "removed") return "No longer available";
  if (it.subjectState === "revoked") return "You no longer have access";
  return partial ? "Status unavailable, retry" : "Needs your decision";
}

function Row({
  it,
  api,
  partial,
}: {
  it: InboxItem;
  api: InboxApi;
  partial: boolean;
}) {
  const status = statusText(it, partial);
  const href = pathFor(
    api.persona.id,
    `inbox/${detailKey(api.venueId, it.id)}`,
  );
  return (
    <VStack
      gap={1}
      hAlign="stretch"
      as="li"
      id={`inbox-row-${it.id}`}
      tabIndex={-1}
      aria-label={it.title}
      style={{ listStyle: "none" }}
    >
      <Item
        href={href}
        label={it.title}
        description={
          it.subjectState === "revoked"
            ? "Details hidden: you no longer have access"
            : it.body
        }
        endContent={
          <Text type="supporting" weight={it.read ? "normal" : "semibold"}>
            {it.read ? "Read" : "Unread"}
          </Text>
        }
      />
      <HStack gap={2} wrap="wrap" vAlign="center" padding={1}>
        {status && (
          <Text type="supporting" weight="semibold">
            {status}
          </Text>
        )}
        {partial && it.tab === "action" && it.subjectState === "open" && (
          <Button
            label="Retry"
            size="sm"
            variant="secondary"
            aria-label={`Retry status: ${it.title}`}
            onClick={api.refresh}
            style={{ minBlockSize: "2.75rem" }}
          />
        )}
        {it.requiresAck && (
          <Text type="supporting">
            {it.acknowledged ? "Acknowledged" : "Awaiting acknowledgement"}
          </Text>
        )}
        {!it.read && (
          <Button
            label="Mark read"
            size="sm"
            aria-label={`Mark read: ${it.title}`}
            onClick={() => api.markRead(it.id)}
            style={{ minBlockSize: "2.75rem" }}
          />
        )}
        {it.requiresAck && !it.acknowledged && (
          <Button
            label="Acknowledge"
            size="sm"
            variant="primary"
            aria-label={`Acknowledge: ${it.title}`}
            onClick={() => api.acknowledge(it.id)}
            style={{ minBlockSize: "2.75rem" }}
          />
        )}
      </HStack>
    </VStack>
  );
}

function ScenarioControls({ api }: { api: InboxApi }) {
  const candidates = scenarioCandidates(api.all, api.remote);
  const [pick, setPick] = useState<string | null>(null);
  const chosen = candidates.find((c) => c.id === pick) ?? candidates[0];
  return (
    <VStack
      gap={2}
      padding={3}
      hAlign="stretch"
      as="section"
      aria-label="Prototype scenario controls"
    >
      <Heading level={3}>Prototype scenario controls</Heading>
      <Text type="supporting">
        Simulates other people changing things for this recipient only. Nothing
        is sent anywhere. The change shows up after Refresh.
      </Text>
      {chosen ? (
        <>
          <Selector
            label="Unread action item to change"
            presentation="adaptive"
            value={chosen.id}
            options={candidates.map((c) => ({ value: c.id, label: c.title }))}
            onChange={setPick}
          />
          <Text type="supporting">{`Chosen item: ${chosen.title}`}</Text>
          <HStack gap={2} wrap="wrap">
            <Button
              label="Another manager resolves an action"
              onClick={() => api.emit("manager", chosen.subjectId)}
            />
            <Button
              label="Another staff member fills an offer"
              onClick={() => api.emit("offer", chosen.subjectId)}
            />
          </HStack>
        </>
      ) : (
        <Text type="supporting">
          No unread open action item is available to change.
        </Text>
      )}
      <Text type="supporting">{`Changes waiting for Refresh: ${api.remote.length}`}</Text>
    </VStack>
  );
}

export function InboxPage({ personaId }: { personaId: PersonaId }) {
  const api = useInbox(personaId);
  const p = useProto();
  const ready = useScenarioReady();
  const [ui, setUi] = useProtoSlice<InboxUi>(
    `inbox.ui.${api.persona.recipientId}.${api.venueId}`,
    INITIAL_UI,
  );
  const [confirmAll, setConfirmAll] = useState(false);
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spKey = sp?.toString() ?? "";
  const params = parseInboxParams(new URLSearchParams(spKey));
  // Initial tab from the URL, applied once per distinct query string. An invalid value falls back to action.
  const appliedKey = useRef<string | null>(null);
  useEffect(() => {
    if (appliedKey.current === spKey) return;
    appliedKey.current = spKey;
    const want = params.tab ?? (params.tabInvalid ? "action" : null);
    if (want) setUi((u) => (u.tab === want ? u : changeTab(u, want)));
  }, [spKey, params.tab, params.tabInvalid, setUi]);
  const decisionItem = params.decision
    ? findDecisionItem(api.items, params.decision)
    : undefined;
  const focusId = decisionItem?.id;
  const focusTab = decisionItem?.tab;
  const focusedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || !ready || ui.tab !== focusTab) return;
    if (focusedKey.current === `${spKey}|${focusId}`) return;
    const el = document.getElementById(`inbox-row-${focusId}`);
    if (!el) return;
    focusedKey.current = `${spKey}|${focusId}`;
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
  });
  const clearScope = () => {
    const q = new URLSearchParams(spKey);
    for (const k of ["scope", "decision"]) q.delete(k);
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  };
  useScrollRestore(
    ui.scroll,
    (y) =>
      setUi((u) =>
        u.scroll === Math.round(y) ? u : { ...u, scroll: Math.round(y) },
      ),
    ready && p.scenario !== "error",
  );
  useEffect(() => {
    if (confirmAll) document.getElementById("inbox-confirm-all")?.focus();
  }, [confirmAll]);

  const canCompose = can(api.persona, "announcements.compose");
  const partial = p.scenario === "partial";

  if (!ready) {
    return (
      <Section title="Inbox" status="loading" skeletonRows={5} level={2} />
    );
  }
  if (p.scenario === "error") {
    return (
      <Section
        title="Inbox"
        status="error"
        message="The Inbox could not be loaded (simulated). Switch the scenario to Default in Prototype controls, then Retry."
        onRetry={api.refresh}
      />
    );
  }
  if (p.scenario === "denied") {
    return (
      <Section
        title="Inbox"
        status="denied"
        message="Your access does not include this Inbox in the denied scenario. Nothing was changed."
      />
    );
  }

  const tab = ui.tab;
  const feed = loadFeed(applyScope(api.items, params.scope), ui);
  const groups = groupItems(feed.items);
  const counts = countsFor(api.items, tab);
  const venueName = api.venue?.name ?? "this venue";
  const unreadInTab = counts.unread;

  return (
    <VStack gap={3} hAlign="stretch">
      <VStack gap={1} hAlign="stretch">
        <Heading level={2}>Inbox</Heading>
        <Text type="supporting">{`Sample data · ${venueName} · recipient ${api.persona.label}`}</Text>
      </VStack>
      <Banner
        status="info"
        collapsible={false}
        title={`Showing ${venueName} only`}
        description="Items for your other venues are not shown here. Use the Venue selector at the top to see them; the Inbox never switches venue for you."
      />
      {p.scenario === "stale" && (
        <Banner
          status="warning"
          collapsible={false}
          title="This data may be out of date"
          description="Showing the last loaded copy (as of 17 Nov, 10:30 am). Refresh to check again."
          endContent={<Button label="Refresh" onClick={api.refresh} />}
        />
      )}
      <StatusFeedback
        status={api.feedback.status}
        message={api.feedback.message}
        onDismiss={api.dismissFeedback}
      />
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Button
          label="Refresh"
          onClick={api.refresh}
          variant="secondary"
          style={{ minBlockSize: "2.75rem" }}
        />
        {api.remote.length > 0 && (
          <Text type="supporting" weight="semibold">
            {`${api.remote.length} change${api.remote.length === 1 ? "" : "s"} happened elsewhere. Refresh to see ${api.remote.length === 1 ? "it" : "them"}.`}
          </Text>
        )}
      </HStack>

      {params.tabInvalid && (
        <Banner
          status="warning"
          collapsible={false}
          title="Unknown tab in the link"
          description="That tab is not available, so Action needed is shown."
        />
      )}
      {params.scopeUnsupported && (
        <Banner
          status="warning"
          collapsible={false}
          title={`Scope "${params.scopeUnsupported}" is not supported`}
          description="Showing the full list instead."
          endContent={<Button label="Clear" onClick={clearScope} />}
        />
      )}
      {(params.scope || params.decision) && (
        <HStack gap={2} wrap="wrap" vAlign="center" aria-label="Active scope">
          <Badge
            label={`Showing: ${params.scope === "urgent" ? "Urgent, unresolved actions" : `Decision ${params.decision}`}`}
            variant="info"
          />
          <Button
            label="Clear"
            variant="secondary"
            onClick={clearScope}
            style={{ minBlockSize: "2.75rem" }}
          />
        </HStack>
      )}
      {params.decision && !decisionItem && (
        <Banner
          status="info"
          collapsible={false}
          title="Decision not found"
          description={`No item matching "${params.decision}" is in this venue's Inbox. It may be resolved, or belong to another venue.`}
        />
      )}

      <TabList
        role="tablist"
        aria-label="Inbox sections"
        value={tab}
        layout="fill"
        hasDivider
        onChange={(v) => setUi((u) => changeTab(u, v as InboxTab))}
      >
        {TABS.map((t) => {
          const c = countsFor(api.items, t);
          const n = t === "action" ? c.unresolved : c.unread;
          return (
            <Tab
              key={t}
              value={t}
              label={TAB_LABEL[t]}
              panelId={PANEL_ID}
              endContent={
                n > 0 ? (
                  <Badge
                    label={String(n)}
                    variant={t === "action" ? "warning" : "neutral"}
                  />
                ) : undefined
              }
            />
          );
        })}
      </TabList>

      <VStack
        gap={3}
        hAlign="stretch"
        id={PANEL_ID}
        role="tabpanel"
        aria-label={TAB_LABEL[tab]}
      >
        <VStack gap={0} hAlign="stretch">
          <Text weight="semibold">{`Unread ${counts.unread}`}</Text>
          {tab === "action" && (
            <Text weight="semibold">{`Unresolved actions ${counts.unresolved}`}</Text>
          )}
          {tab === "announcements" && (
            <Text weight="semibold">{`Awaiting acknowledgement ${counts.awaitingAck}`}</Text>
          )}
          <Text type="supporting">
            {tab === "action"
              ? "Unresolved actions still need a decision. Reading never approves or resolves anything."
              : tab === "announcements"
                ? "Reading is not acknowledging. Acknowledge is a separate button."
                : "Updates are for information. Reading changes unread only."}
          </Text>
        </VStack>

        <HStack gap={3} wrap="wrap" vAlign="center">
          <Switch
            label="Unread only"
            value={ui.unreadOnly}
            onChange={(v) => setUi((u) => changeUnreadOnly(u, v))}
          />
          {tab !== "action" && (
            <Button
              id="inbox-mark-all"
              label={`Mark all ${TAB_LABEL[tab].toLowerCase()} read`}
              variant="secondary"
              isDisabled={unreadInTab === 0}
              onClick={() => setConfirmAll(true)}
              style={{ minBlockSize: "2.75rem" }}
            />
          )}
          {tab === "announcements" &&
            (canCompose ? (
              <Button
                label="Write an announcement"
                href={pathFor(personaId, "team/announcements")}
                variant="secondary"
                style={{ minBlockSize: "2.75rem" }}
              />
            ) : (
              <Text type="supporting">
                Only people with announcement rights can write announcements.
              </Text>
            ))}
        </HStack>
        {tab === "action" && (
          <Text type="supporting">
            Mark all read is not offered for Action needed: those items need a
            decision, not a bulk dismissal.
          </Text>
        )}
        {confirmAll && tab !== "action" && (
          <Banner
            status="info"
            collapsible={false}
            title={`Mark ${unreadInTab} unread ${TAB_LABEL[tab].toLowerCase()} as read?`}
            description="This only clears the unread state. It does not acknowledge any announcement and does not resolve any action."
            endContent={
              <HStack gap={2} wrap="wrap">
                <Button
                  id="inbox-confirm-all"
                  label="Yes, mark all read"
                  variant="primary"
                  onClick={() => {
                    api.markAllRead(tab);
                    setConfirmAll(false);
                    requestAnimationFrame(() =>
                      document.getElementById("inbox-mark-all")?.focus(),
                    );
                  }}
                />
                <Button
                  label="Cancel"
                  onClick={() => {
                    setConfirmAll(false);
                    requestAnimationFrame(() =>
                      document.getElementById("inbox-mark-all")?.focus(),
                    );
                  }}
                />
              </HStack>
            }
          />
        )}

        {feed.total === 0 ? (
          <Banner
            status="info"
            collapsible={false}
            title={
              ui.unreadOnly
                ? "Nothing unread here"
                : api.venue?.empty
                  ? "No notices yet in this venue"
                  : `No ${TAB_LABEL[tab].toLowerCase()} right now`
            }
            description={
              ui.unreadOnly
                ? "Turn off Unread only to see items you have already read."
                : "New items appear here when something needs you."
            }
            endContent={
              ui.unreadOnly ? (
                <Button
                  label="Show all"
                  onClick={() => setUi((u) => changeUnreadOnly(u, false))}
                />
              ) : undefined
            }
          />
        ) : (
          <VStack gap={3} hAlign="stretch">
            <Text
              type="supporting"
              aria-live="polite"
            >{`Showing ${feed.items.length} of ${feed.total}`}</Text>
            {groups.map((g) => (
              <VStack
                key={g.label}
                gap={1}
                hAlign="stretch"
                as="section"
                aria-label={g.label}
              >
                <Heading level={3}>{g.label}</Heading>
                <VStack gap={2} hAlign="stretch" as="ul" padding={0}>
                  {g.items.map((it) => (
                    <Row key={it.id} it={it} api={api} partial={partial} />
                  ))}
                </VStack>
              </VStack>
            ))}
            {feed.hasMore && (
              <Button
                label="Load more"
                onClick={() => setUi((u) => loadMore(u))}
                style={{ minBlockSize: "2.75rem" }}
              />
            )}
          </VStack>
        )}
      </VStack>

      <ScenarioControls api={api} />
      <Text type="supporting">{`Simulated changes applied this session: ${api.log.length}`}</Text>
    </VStack>
  );
}
