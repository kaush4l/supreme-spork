import { mayOpen, type Rights } from "@/server/nav";

/** What a notice opens, as the backend sends it (`target`). */
export type NoticeLink = { kind: string; id?: string | null };

/**
 * Where a notice leads: the page path under the venue, or null when there is nowhere to go or the person's navigation
 * does not have the page (then the notice shows no link). `noticeKind` only settles a tie: a decided request goes to
 * "Requests" for its owner, a new request goes to "Approvals" for whoever decides. Pure.
 */
export function noticeHref(
  target: NoticeLink | null | undefined,
  me: Rights,
  noticeKind?: string,
): string | null {
  if (!target) return null;
  const id = target.id ?? null;
  switch (target.kind) {
    case "offer":
      return id && mayOpen(me, "shifts") ? `/shifts/offers/${id}` : null;
    case "roster_draft":
      // the person asked to reply answers on their own shifts; otherwise a roster builder opens the draft
      if (mayOpen(me, "shifts")) return "/shifts/drafts";
      return id && mayOpen(me, "roster") ? `/roster/drafts/${id}` : null;
    case "roster_request": {
      const order =
        noticeKind === "request_decided"
          ? (["requests", "approvals"] as const)
          : (["approvals", "requests"] as const);
      const key = order.find((k) => mayOpen(me, k));
      return key ? `/${key}` : null;
    }
    case "checklist":
      if (!id) return null;
      if (mayOpen(me, "board")) return `/board/${id}`;
      return mayOpen(me, "lists") ? `/lists/${id}` : null;
    case "change_request":
      return mayOpen(me, "changes") ? "/changes" : null;
    case "shift":
      return mayOpen(me, "shifts") ? "/shifts" : null;
    default:
      return null;
  }
}

/** A notice's target, with the old way (`issued_list_id`) as a fallback for an answer that has no `target`. */
export function targetOf(n: {
  target?: NoticeLink | null;
  issued_list_id?: string | null;
}): NoticeLink | null {
  if (n.target) return n.target;
  return n.issued_list_id ? { kind: "checklist", id: n.issued_list_id } : null;
}

/** The words on a notice's link: "Open" while it needs the person, "See what happened" once it does not. */
export function linkWords(live: boolean): string {
  return live ? "Open" : "See what happened";
}
