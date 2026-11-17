/**
 * Pure Inbox state logic (no React, no network). Read state, acknowledgement and resolution are three independent
 * pieces of state; no function here lets one change another except where stated.
 */
import { queryInbox } from "../../adapter";
import {
  INBOX_PAGE_SIZE,
  offerFilledByOther,
  resolveByOtherManager,
} from "../../fixtures/inbox";
import { agoIso } from "../../fixtures/time";
import type { InboxItem, InboxTab } from "../../types";

export const TABS: InboxTab[] = ["action", "updates", "announcements"];
export const TAB_LABEL: Record<InboxTab, string> = {
  action: "Action needed",
  updates: "Updates",
  announcements: "Announcements",
};

export interface TabCounts {
  unread: number;
  /** Action tab: open subjects still needing a decision. Other tabs: 0. */
  unresolved: number;
  /** Announcements: requiresAck and not yet acknowledged. */
  awaitingAck: number;
}

export function countsFor(items: InboxItem[], tab: InboxTab): TabCounts {
  const mine = items.filter((i) => i.tab === tab);
  return {
    unread: mine.filter((i) => !i.read).length,
    unresolved:
      tab === "action"
        ? mine.filter((i) => i.subjectState === "open").length
        : 0,
    awaitingAck: mine.filter((i) => i.requiresAck && !i.acknowledged).length,
  };
}

const patch = (
  items: InboxItem[],
  id: string,
  fn: (i: InboxItem) => InboxItem,
) => items.map((i) => (i.id === id ? fn(i) : i));

/** Unread state only. Never touches acknowledged, subjectState or outcome. */
export function markRead(items: InboxItem[], id: string): InboxItem[] {
  return patch(items, id, (i) => (i.read ? i : { ...i, read: true }));
}

/**
 * Mark all read for ONE tab. Action needed is never bulk-marked (returns the same array). Unread state only: never
 * acknowledgement or resolution.
 */
export function markAllRead(items: InboxItem[], tab: InboxTab): InboxItem[] {
  if (tab === "action") return items;
  return items.map((i) =>
    i.tab === tab && !i.read ? { ...i, read: true } : i,
  );
}

/** Explicit acknowledgement. Does not change read state. Only for requiresAck announcements. */
export function acknowledge(items: InboxItem[], id: string): InboxItem[] {
  return patch(items, id, (i) =>
    i.requiresAck && !i.acknowledged ? { ...i, acknowledged: true } : i,
  );
}

/** The recipient's own decision on an open action item. Read state is not changed here. */
export function decide(
  items: InboxItem[],
  id: string,
  decision: "approved" | "declined",
): InboxItem[] {
  return patch(items, id, (i) =>
    i.subjectState !== "open"
      ? i
      : {
          ...i,
          subjectState: "resolved",
          outcome: {
            text:
              decision === "approved" ? "Approved by you" : "Declined by you",
            at: agoIso({ minutes: 0 }),
            by: "You",
          },
        },
  );
}

export type RemoteKind = "manager" | "offer";
export interface RemoteEvent {
  kind: RemoteKind;
  subjectId: string;
}

/** Queue an event for a subject once; a second event for the same subject is ignored. */
export function queueRemote(
  events: RemoteEvent[],
  ev: RemoteEvent,
): RemoteEvent[] {
  return events.some((e) => e.subjectId === ev.subjectId)
    ? events
    : [...events, ev];
}

/** Refresh: apply queued remote events. Only still-open subjects change; read state is preserved. */
export function applyRemote(
  items: InboxItem[],
  events: RemoteEvent[],
): { items: InboxItem[]; changed: number } {
  let next = items;
  let changed = 0;
  for (const ev of events) {
    const target = next.find(
      (i) => i.subjectId === ev.subjectId && i.subjectState === "open",
    );
    if (!target) continue;
    changed++;
    next =
      ev.kind === "manager"
        ? resolveByOtherManager(next, ev.subjectId)
        : offerFilledByOther(next, ev.subjectId);
  }
  return { items: next, changed };
}

/** Unread, still-open action items that have no queued event: candidates for the scenario controls. */
export function scenarioCandidates(
  items: InboxItem[],
  events: RemoteEvent[],
): InboxItem[] {
  return items.filter(
    (i) =>
      i.tab === "action" &&
      !i.read &&
      i.subjectState === "open" &&
      !events.some((e) => e.subjectId === i.subjectId),
  );
}

export interface InboxUi {
  tab: InboxTab;
  unreadOnly: boolean;
  /** Pages loaded (page size 20). */
  pages: number;
  scroll: number;
}
export const INITIAL_UI: InboxUi = {
  tab: "action",
  unreadOnly: false,
  pages: 1,
  scroll: 0,
};
/** Changing tab or filter resets paging and scroll. */
export function changeTab(ui: InboxUi, tab: InboxTab): InboxUi {
  return { ...ui, tab, pages: 1, scroll: 0 };
}
export function changeUnreadOnly(ui: InboxUi, unreadOnly: boolean): InboxUi {
  return { ...ui, unreadOnly, pages: 1, scroll: 0 };
}
export function loadMore(ui: InboxUi): InboxUi {
  return { ...ui, pages: ui.pages + 1 };
}

export interface LoadedFeed {
  items: InboxItem[];
  total: number;
  hasMore: boolean;
}
/** Loads pages 1..pages through queryInbox (filter before paging). */
export function loadFeed(
  items: InboxItem[],
  ui: Pick<InboxUi, "tab" | "unreadOnly" | "pages">,
): LoadedFeed {
  const out: InboxItem[] = [];
  let total = 0;
  for (let p = 0; p < ui.pages; p++) {
    const page = queryInbox(items, {
      tab: ui.tab,
      unreadOnly: ui.unreadOnly,
      limit: INBOX_PAGE_SIZE,
      offset: p * INBOX_PAGE_SIZE,
    });
    total = page.total;
    if (page.clamped) break;
    out.push(...page.items);
  }
  return { items: out, total, hasMore: out.length < total };
}

export interface Group {
  label: string;
  items: InboxItem[];
}
/** Contiguous grouping by `group` label, preserving feed order. */
export function groupItems(items: InboxItem[]): Group[] {
  const groups: Group[] = [];
  for (const it of items) {
    const label = it.group ?? "Other";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  }
  return groups;
}

export type DetailState =
  | "ok"
  | "resolved"
  | "removed"
  | "revoked"
  | "wrong-venue"
  | "missing";

export function detailState(
  item: InboxItem | undefined,
  linkVenueId: string,
  currentVenueId: string,
): DetailState {
  if (linkVenueId !== currentVenueId) return "wrong-venue";
  if (!item) return "missing";
  if (item.subjectState === "removed") return "removed";
  if (item.subjectState === "revoked") return "revoked";
  if (item.subjectState === "resolved") return "resolved";
  return "ok";
}

/** Detail links carry the venue: `<venueId>~<itemId>`. */
export function detailKey(venueId: string, itemId: string): string {
  return `${venueId}~${itemId}`;
}
export function parseDetailKey(
  raw: string,
): { venueId: string; itemId: string } | null {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    // keep raw
  }
  const at = s.indexOf("~");
  if (at <= 0 || at === s.length - 1) return null;
  return { venueId: s.slice(0, at), itemId: s.slice(at + 1) };
}

/** Extra deterministic items for the "busy" scenario so every tab has at least three pages. */
export function busyExtras(recipientId: string, venueId: string): InboxItem[] {
  const out: InboxItem[] = [];
  const make = (tab: InboxTab, n: number, prefix: string, title: string) => {
    for (let i = 101; i < 101 + n; i++) {
      const days = 3 + Math.floor((i - 100) / 6);
      out.push({
        id: `${recipientId}:${prefix}-${i}`,
        recipientId,
        subjectId: `${prefix}-${i}`,
        tab,
        title: `${title} #${i}`,
        body: `Synthetic busy-scenario ${tab} notice ${i} for ${venueId}.`,
        createdAt: agoIso({ days, minutes: i }),
        group: days < 7 ? "This week" : "Earlier",
        read: i % 4 === 0,
        subjectState: "open",
        venueId,
        ...(tab === "announcements"
          ? { requiresAck: i % 5 === 0, acknowledged: false }
          : {}),
      });
    }
  };
  make("action", 40, "act", "Busy: request needs a decision");
  make("updates", 50, "upd", "Busy: roster or docket update");
  make("announcements", 50, "ann", "Busy: venue announcement");
  return out;
}

export function sortFeed(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) =>
    a.createdAt < b.createdAt
      ? 1
      : a.createdAt > b.createdAt
        ? -1
        : a.id.localeCompare(b.id),
  );
}

export interface InboxParams {
  /** Valid tab from the URL, or null when absent. */
  tab: InboxTab | null;
  /** True when a tab value was given but is not one of the three tabs (falls back to action). */
  tabInvalid: boolean;
  scope: "urgent" | null;
  /** A scope value that is present but unsupported, shown as a notice. */
  scopeUnsupported: string | null;
  decision: string | null;
}

/** Drill-down query from Home: `tab`, `scope=urgent`, `decision=<id>`. Unsupported values are reported, never silently dropped. */
export function parseInboxParams(sp: URLSearchParams): InboxParams {
  const rawTab = sp.get("tab");
  const tab = TABS.find((t) => t === rawTab) ?? null;
  const rawScope = sp.get("scope");
  return {
    tab,
    tabInvalid: rawTab !== null && tab === null,
    scope: rawScope === "urgent" ? "urgent" : null,
    scopeUnsupported:
      rawScope !== null && rawScope !== "urgent" ? rawScope : null,
    decision: sp.get("decision") || null,
  };
}

/** Matches a decision id from Home to an inbox item by item id, subject id, or the id after the recipient prefix. */
export function findDecisionItem(
  items: InboxItem[],
  decision: string,
): InboxItem | undefined {
  return items.find(
    (i) =>
      i.id === decision ||
      i.subjectId === decision ||
      i.id.endsWith(`:${decision}`),
  );
}

/** scope=urgent: action items still unresolved. Other tabs are not narrowed. */
export function applyScope(
  items: InboxItem[],
  scope: "urgent" | null,
): InboxItem[] {
  if (scope !== "urgent") return items;
  return items.filter((i) => i.tab !== "action" || i.subjectState === "open");
}
