/**
 * MOCK data adapter. Applies query/filter/sort over the FULL in-memory dataset BEFORE pagination and returns only a
 * page plus total. This is NOT production server pagination; production page-range behaviour is a separate API
 * decision. No network, no server imports.
 */
import type {
  Docket,
  DocketQuery,
  InboxItem,
  InboxTab,
  Page,
  Scenario,
  StaffMember,
} from "./types";

/** Page with an extra mock-only flag set when the requested offset was out of range and clamped. */
export type ClampedPage<T> = Page<T> & { clamped?: boolean };

/**
 * Out-of-range offset clamps to the start of the last valid page (offset = floor((total-1)/limit)*limit; 0 when
 * total is 0). The returned `offset` is the clamped value and `clamped` is true.
 */
function paginate<T>(rows: T[], limit: number, offset: number): ClampedPage<T> {
  const lim = Math.max(1, Math.floor(limit));
  const total = rows.length;
  const lastStart = total === 0 ? 0 : Math.floor((total - 1) / lim) * lim;
  const want = Math.max(0, Math.floor(offset));
  const eff = Math.min(want, lastStart);
  const page: ClampedPage<T> = {
    items: rows.slice(eff, eff + lim),
    total,
    limit: lim,
    offset: eff,
  };
  if (eff !== want) page.clamped = true;
  return page;
}

export function queryDockets(
  all: Docket[],
  q: DocketQuery,
): ClampedPage<Docket> {
  const needle = q.q?.trim().toLowerCase();
  let rows = all.filter((d) => {
    if (
      needle &&
      !`${d.id} ${d.supplier} ${d.uploadedBy}`.toLowerCase().includes(needle)
    )
      return false;
    if (q.supplier && d.supplier !== q.supplier) return false;
    if (q.status && d.status !== q.status) return false;
    if (q.from && d.date < q.from) return false;
    if (q.to && d.date > q.to) return false;
    return true;
  });
  const sort = q.sort ?? "date_desc";
  const byId = (a: Docket, b: Docket) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  rows = [...rows].sort((a, b) => {
    let c = 0;
    if (sort === "date_desc")
      c = a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    else if (sort === "date_asc")
      c = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    else if (sort === "supplier_asc") c = a.supplier.localeCompare(b.supplier);
    else if (sort === "total_desc")
      c = (b.totalCents ?? -1) - (a.totalCents ?? -1);
    return c !== 0 ? c : byId(a, b);
  });
  return paginate(rows, q.limit, q.offset);
}

export function queryInbox(
  items: InboxItem[],
  o: { tab: InboxTab; unreadOnly?: boolean; limit: number; offset: number },
): ClampedPage<InboxItem> {
  const rows = items.filter(
    (i) => i.tab === o.tab && (!o.unreadOnly || !i.read),
  );
  return paginate(rows, o.limit, o.offset);
}

export function searchStaff(
  all: StaffMember[],
  q: string,
  limit: number,
  offset: number,
): ClampedPage<StaffMember> {
  const n = q.trim().toLowerCase();
  const rows = n
    ? all.filter((s) => `${s.name} ${s.role}`.toLowerCase().includes(n))
    : all;
  return paginate(rows, limit, offset);
}

export type MutationResult<T> =
  | { status: "success"; value: T }
  | { status: "failure"; message: string }
  | { status: "pending" }
  | { status: "duplicate" };

/**
 * Simulated mutation. Scenario 'loading'/'slow' => pending (deterministic, no timers); 'error' => failure;
 * otherwise runs fn. A second call with the same key while `seen` has it returns 'duplicate' without running fn.
 * The key is recorded on first call (including pending/failure) so rapid double clicks are caught.
 */
export function simulateMutation<T>(
  fn: () => T,
  opts: { scenario: Scenario; key: string; seen: Set<string> },
): MutationResult<T> {
  if (opts.seen.has(opts.key)) return { status: "duplicate" };
  opts.seen.add(opts.key);
  if (opts.scenario === "loading" || opts.scenario === "slow")
    return { status: "pending" };
  if (opts.scenario === "error")
    return {
      status: "failure",
      message: "Simulated failure. Nothing was changed.",
    };
  return { status: "success", value: fn() };
}
