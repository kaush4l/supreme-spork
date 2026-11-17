import { describe, expect, test } from "bun:test";
import { initialInbox } from "../../fixtures/inbox";
import {
  acknowledge,
  applyRemote,
  busyExtras,
  changeTab,
  changeUnreadOnly,
  countsFor,
  decide,
  detailKey,
  detailState,
  groupItems,
  INITIAL_UI,
  loadFeed,
  loadMore,
  markAllRead,
  markRead,
  parseDetailKey,
  queueRemote,
  scenarioCandidates,
  sortFeed,
} from "./inbox-logic";

const base = () => initialInbox("u-manager", "v-harbour");

describe("counts and independence", () => {
  test("reading does not acknowledge or resolve", () => {
    const items = base();
    const ann = items.find((i) => i.requiresAck && !i.acknowledged)!;
    const act = items.find(
      (i) => i.tab === "action" && i.subjectState === "open",
    )!;
    let next = markRead(items, ann.id);
    next = markRead(next, act.id);
    expect(next.find((i) => i.id === ann.id)?.acknowledged).toBeFalsy();
    expect(next.find((i) => i.id === act.id)?.subjectState).toBe("open");
  });
  test("acknowledge leaves read state alone", () => {
    const items = base();
    const ann = items.find((i) => i.requiresAck && !i.acknowledged && !i.read);
    if (!ann) return;
    const next = acknowledge(items, ann.id);
    expect(next.find((i) => i.id === ann.id)?.read).toBe(false);
    expect(next.find((i) => i.id === ann.id)?.acknowledged).toBe(true);
  });
  test("mark all read: unread only, never action, never ack/resolution", () => {
    const items = base();
    const before = countsFor(items, "action");
    const next = markAllRead(markAllRead(items, "action"), "updates");
    expect(countsFor(next, "action")).toEqual(before);
    expect(countsFor(next, "updates").unread).toBe(0);
    expect(countsFor(next, "announcements").unread).toBe(
      countsFor(items, "announcements").unread,
    );
    expect(countsFor(next, "announcements").awaitingAck).toBe(
      countsFor(items, "announcements").awaitingAck,
    );
  });
});

describe("remote resolution", () => {
  test("drops unresolved, keeps unread, retains outcome", () => {
    const items = base();
    const target = scenarioCandidates(items, [])[0]!;
    const before = countsFor(items, "action");
    const ev = queueRemote([], {
      kind: "manager",
      subjectId: target.subjectId,
    });
    expect(
      queueRemote(ev, { kind: "offer", subjectId: target.subjectId }),
    ).toBe(ev);
    const { items: after, changed } = applyRemote(items, ev);
    expect(changed).toBe(1);
    const c = countsFor(after, "action");
    expect(c.unresolved).toBe(before.unresolved - 1);
    expect(c.unread).toBe(before.unread);
    const it = after.find((i) => i.id === target.id)!;
    expect(it.read).toBe(false);
    expect(it.outcome?.text).toContain("another manager");
    // decide on resolved item is a no-op (no second decision)
    expect(decide(after, target.id, "approved")).toEqual(after);
  });
  test("offer filled wording", () => {
    const items = base();
    const t = scenarioCandidates(items, [])[0]!;
    const { items: after } = applyRemote(items, [
      { kind: "offer", subjectId: t.subjectId },
    ]);
    expect(after.find((i) => i.id === t.id)?.outcome?.text).toContain("filled");
  });
});

describe("ui and paging", () => {
  test("tab/filter reset paging; load more increments", () => {
    let ui = loadMore(INITIAL_UI);
    expect(ui.pages).toBe(2);
    ui = changeUnreadOnly(ui, true);
    expect(ui.pages).toBe(1);
    ui = changeTab(loadMore(ui), "updates");
    expect(ui).toMatchObject({ tab: "updates", pages: 1, unreadOnly: true });
  });
  test("loadFeed pages of 20 and busy fixtures have >= 3 pages", () => {
    const items = sortFeed([
      ...base(),
      ...busyExtras("u-manager", "v-harbour"),
    ]);
    for (const tab of ["action", "updates", "announcements"] as const) {
      const f1 = loadFeed(items, { tab, unreadOnly: false, pages: 1 });
      expect(f1.items.length).toBe(20);
      const f3 = loadFeed(items, { tab, unreadOnly: false, pages: 3 });
      expect(f3.items.length).toBe(60);
    }
    const small = loadFeed(base(), {
      tab: "action",
      unreadOnly: false,
      pages: 5,
    });
    expect(small.items.length).toBe(24);
    expect(small.hasMore).toBe(false);
  });
  test("grouping is contiguous", () => {
    const f = loadFeed(base(), { tab: "updates", unreadOnly: false, pages: 1 });
    const g = groupItems(f.items);
    expect(g.reduce((n, x) => n + x.items.length, 0)).toBe(f.items.length);
    expect(new Set(g.map((x) => x.label)).size).toBe(g.length);
  });
});

describe("detail", () => {
  test("states", () => {
    const items = base();
    const removed = items.find((i) => i.subjectState === "removed");
    const revoked = items.find((i) => i.subjectState === "revoked");
    expect(detailState(removed, "v-harbour", "v-harbour")).toBe("removed");
    expect(detailState(revoked, "v-harbour", "v-harbour")).toBe("revoked");
    expect(detailState(items[0], "v-perth", "v-harbour")).toBe("wrong-venue");
    expect(detailState(undefined, "v-harbour", "v-harbour")).toBe("missing");
  });
  test("detail key round trip", () => {
    const k = detailKey("v-harbour", "u-staff:act-003");
    expect(parseDetailKey(encodeURIComponent(k))).toEqual({
      venueId: "v-harbour",
      itemId: "u-staff:act-003",
    });
    expect(parseDetailKey("nonsense")).toBeNull();
  });
});
