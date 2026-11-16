/** Where an attention item's `target.kind` leads in the web UI: the page path (after the venue) and the navigation key
 * that must be open to the person. Every kind the backend can send is listed (see `targets.test.ts`); a kind not
 * listed has no button. Pure. */
export type TargetPage = { path: string; nav: string };

const PAGES: Record<string, (id: string | null) => TargetPage> = {
  // The summary's money items.
  dockets_queue: () => ({ path: "/dockets", nav: "dockets" }),
  bank_questions: () => ({ path: "/bank", nav: "bank" }),
  bank_files_review: () => ({ path: "/bank/files", nav: "bank" }),
  sales_reports_review: () => ({ path: "/sales-files", nav: "sales-files" }),
  bills_overdue: () => ({ path: "/bills", nav: "bills" }),
  bills_due_soon: () => ({ path: "/bills", nav: "bills" }),
  staff: () => ({ path: "/team", nav: "team" }),
  // Checklists for the day: the Today board.
  checklists_overdue: () => ({ path: "/board", nav: "board" }),
  // One finding, one request, one offer, one draft, one change, one licence.
  finding: (id) => ({
    path: id ? `/findings/${id}` : "/week",
    nav: "week",
  }),
  roster_request: () => ({ path: "/approvals", nav: "approvals" }),
  shift_offer: () => ({ path: "/roster/offers", nav: "roster" }),
  roster_draft: (id) => ({
    path: id ? `/roster/drafts/${id}` : "/roster",
    nav: "roster",
  }),
  change_request: () => ({ path: "/changes", nav: "changes" }),
  expiry_item: (id) => ({
    path: id ? `/expiry/${id}` : "/expiry",
    nav: "expiry",
  }),
};

/** Every target kind this mapping covers. */
export const TARGET_KINDS = Object.keys(PAGES);

/** The page for a target, or null when the kind is unknown (the card then has no button). */
export function targetPage(
  kind: string | undefined | null,
  id?: string | null,
): TargetPage | null {
  const page = kind ? PAGES[kind] : undefined;
  return page ? page(id ?? null) : null;
}
