/** The pages where a state changes under a person's hands (an offer gets filled, a request is decided, a list is
 * finished), so they refresh their own data. Other pages are read once when opened. Pure, so it is tested. */
const LIVE_PAGES = [
  "/attention",
  "/notices",
  "/approvals",
  "/requests",
  "/board",
  "/today",
  "/actions",
  "/roster/offers",
  "/roster/drafts",
  "/shifts/drafts",
  "/shifts/offers",
  "/changes",
];

/** How often a visible tab asks for fresh data, in milliseconds. */
export const REFRESH_EVERY_MS = 30_000;

/** `pathname` is the whole path (`/venues/<id>/notices`); `base` is `/venues/<id>`. */
export function staysFresh(pathname: string, base: string): boolean {
  if (!pathname.startsWith(`${base}/`)) return false;
  const rest = pathname.slice(base.length);
  return LIVE_PAGES.some((p) => rest === p || rest.startsWith(`${p}/`));
}
