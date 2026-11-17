import type { InboxItem, InboxTab } from "../types";
import { mulberry32 } from "./prng";
import { agoIso } from "./time";

export const INBOX_PAGE_SIZE = 20;

const actionTitles = [
  "Swap request needs approval",
  "Docket needs review",
  "Shift offer: Friday close",
  "Leave request awaiting decision",
  "Cash variance to explain",
];
const updateTitles = [
  "Roster published",
  "Your swap was approved",
  "Docket approved",
  "Shift time changed",
];
const announceTitles = [
  "New food safety procedure",
  "Christmas trading hours",
  "Updated uniform policy",
];

/** 54 deterministic items: 24 action, 18 updates, 12 announcements. Ids are `${recipientId}:${subjectId}`. */
export function initialInbox(
  recipientId: string,
  venueId: string,
): InboxItem[] {
  const rng = mulberry32(recipientId.length * 977 + venueId.length * 13);
  const items: InboxItem[] = [];
  const make = (tab: InboxTab, n: number, titles: string[], prefix: string) => {
    for (let i = 1; i <= n; i++) {
      const subjectId = `${prefix}-${String(i).padStart(3, "0")}`;
      const days = Math.floor(i / 3);
      const sub: InboxItem["subjectState"] =
        tab !== "action"
          ? "open"
          : i === 5
            ? "removed"
            : i === 9
              ? "revoked"
              : "open";
      const item: InboxItem = {
        id: `${recipientId}:${subjectId}`,
        recipientId,
        subjectId,
        tab,
        title: `${titles[(i - 1) % titles.length]} #${i}`,
        body: `Synthetic ${tab} notice ${i} for ${venueId}.`,
        createdAt: agoIso({ days, minutes: i * 7 }),
        group:
          days === 0
            ? "Today"
            : days === 1
              ? "Yesterday"
              : days < 7
                ? "This week"
                : "Earlier",
        read: rng() < 0.45,
        subjectState: sub,
        venueId,
      };
      if (tab === "announcements") {
        item.requiresAck = i % 3 === 0;
        item.acknowledged = item.requiresAck ? i % 6 === 0 : undefined;
      }
      if (tab === "action" && (i === 5 || i === 9)) item.read = false;
      items.push(item);
    }
  };
  make("action", 24, actionTitles, "act");
  make("updates", 18, updateTitles, "upd");
  make("announcements", 12, announceTitles, "ann");
  // Guarantee some unread in each tab.
  for (const t of ["action", "updates", "announcements"] as InboxTab[]) {
    const first = items.find((x) => x.tab === t);
    if (first) first.read = false;
  }
  // newest first
  return items.sort((a, b) =>
    a.createdAt < b.createdAt
      ? 1
      : a.createdAt > b.createdAt
        ? -1
        : a.id.localeCompare(b.id),
  );
}

/** Another manager resolved the subject. Outcome set, subject resolved; read state is NOT changed. */
export function resolveByOtherManager(
  items: InboxItem[],
  subjectId: string,
): InboxItem[] {
  return items.map((it) =>
    it.subjectId === subjectId
      ? {
          ...it,
          subjectState: "resolved",
          outcome: {
            text: "Resolved by another manager",
            at: agoIso({ minutes: 0 }),
            by: "Another manager",
          },
        }
      : it,
  );
}

/** Another staff member filled the offer. Outcome set, subject resolved; read state is NOT changed. */
export function offerFilledByOther(
  items: InboxItem[],
  subjectId: string,
): InboxItem[] {
  return items.map((it) =>
    it.subjectId === subjectId
      ? {
          ...it,
          subjectState: "resolved",
          outcome: {
            text: "This shift was filled by another staff member",
            at: agoIso({ minutes: 0 }),
            by: "Another staff member",
          },
        }
      : it,
  );
}
