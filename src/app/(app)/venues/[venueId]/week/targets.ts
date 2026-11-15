/** Where an attention item's `target.kind` leads in the web UI: the page path (after the venue) and the navigation key
 * that must be open to the person. A kind not listed here has no link. Pure. */
const PAGES: Record<string, { path: string; nav: string }> = {
  dockets_queue: { path: "/dockets", nav: "dockets" },
  bank_questions: { path: "/bank", nav: "bank" },
  bank_files_review: { path: "/bank/files", nav: "bank" },
  sales_reports_review: { path: "/sales-files", nav: "sales-files" },
  bills_overdue: { path: "/bills", nav: "bills" },
  bills_due_soon: { path: "/bills", nav: "bills" },
  checklists_overdue: { path: "/board", nav: "board" },
  staff: { path: "/team", nav: "team" },
};

/** The page for a target kind, or null when the kind is unknown. */
export function targetPage(
  kind: string | undefined | null,
): { path: string; nav: string } | null {
  return kind ? (PAGES[kind] ?? null) : null;
}
