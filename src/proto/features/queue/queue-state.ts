/** Pure helpers for the Dockets queue: URL query encoding, page maths, status overlay and context restoration. */
import type { Docket, DocketQuery, DocketStatus } from "../../types";

export const PAGE_SIZE = 25;
export const SORTS = [
  "date_desc",
  "date_asc",
  "supplier_asc",
  "total_desc",
] as const;
export type SortKey = (typeof SORTS)[number];
export const STATUSES: DocketStatus[] = [
  "new",
  "needs_review",
  "approved",
  "rejected",
];

export const SORT_LABEL: Record<SortKey, string> = {
  date_desc: "Date, newest first",
  date_asc: "Date, oldest first",
  supplier_asc: "Supplier A to Z",
  total_desc: "Total, highest first",
};
export const STATUS_LABEL: Record<DocketStatus, string> = {
  new: "New",
  needs_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
};

export interface QueueQuery {
  q: string;
  supplier: string;
  status: DocketStatus | "";
  from: string;
  to: string;
  sort: SortKey;
  /** 1-based. */
  page: number;
}

export const DEFAULT_QUERY: QueueQuery = {
  q: "",
  supplier: "",
  status: "",
  from: "",
  to: "",
  sort: "date_desc",
  page: 1,
};

type ParamSource = { get(name: string): string | null };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseQueueParams(sp: ParamSource): QueueQuery {
  const status = sp.get("status") ?? "";
  const sort = sp.get("sort") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const pageNum = Number.parseInt(sp.get("page") ?? "1", 10);
  return {
    q: sp.get("q") ?? "",
    supplier: sp.get("supplier") ?? "",
    status: (STATUSES as string[]).includes(status)
      ? (status as DocketStatus)
      : "",
    from: YMD.test(from) ? from : "",
    to: YMD.test(to) ? to : "",
    sort: (SORTS as readonly string[]).includes(sort)
      ? (sort as SortKey)
      : "date_desc",
    page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1,
  };
}

/** Stable key order; defaults are omitted so the same state always yields the same string. */
export function serializeQueueParams(q: QueueQuery): string {
  const sp = new URLSearchParams();
  if (q.q.trim()) sp.set("q", q.q.trim());
  if (q.supplier) sp.set("supplier", q.supplier);
  if (q.status) sp.set("status", q.status);
  if (q.from) sp.set("from", q.from);
  if (q.to) sp.set("to", q.to);
  if (q.sort !== "date_desc") sp.set("sort", q.sort);
  if (q.page > 1) sp.set("page", String(q.page));
  return sp.toString();
}

/** Any filter, search or sort change returns to page 1; only an explicit `page` patch keeps the page. */
export function applyChange(
  q: QueueQuery,
  patch: Partial<QueueQuery>,
): QueueQuery {
  const next = { ...q, ...patch };
  if (!("page" in patch)) next.page = 1;
  return next;
}

export function toDocketQuery(q: QueueQuery): DocketQuery {
  return {
    q: q.q || undefined,
    supplier: q.supplier || undefined,
    status: q.status || undefined,
    from: q.from || undefined,
    to: q.to || undefined,
    sort: q.sort,
    limit: PAGE_SIZE,
    offset: (q.page - 1) * PAGE_SIZE,
  };
}

export function pageFromOffset(offset: number): number {
  return Math.floor(offset / PAGE_SIZE) + 1;
}

/** "Showing 26–50 of 120"; "Showing 0 of 0" when empty. */
export function rangeLabel(
  offset: number,
  itemCount: number,
  total: number,
): string {
  if (total === 0 || itemCount === 0) return "Showing 0 of 0";
  return `Showing ${offset + 1}–${offset + itemCount} of ${total}`;
}

export function activeFilterCount(q: QueueQuery): number {
  return [q.supplier, q.status, q.from, q.to].filter(Boolean).length;
}

export type StatusOverrides = Record<string, DocketStatus>;
export const overrideKey = (venueId: string, id: string) => `${venueId}:${id}`;

/** Apply review decisions on top of the fixture dataset (fixture data is never mutated). */
export function applyOverrides(
  all: Docket[],
  overrides: StatusOverrides,
): Docket[] {
  return all.map((d) => {
    const s = overrides[overrideKey(d.venueId, d.id)];
    return s && s !== d.status ? { ...d, status: s } : d;
  });
}

export function canReview(status: DocketStatus): boolean {
  return status === "new" || status === "needs_review";
}

/** Context saved when a row is opened and when the queue scrolls, used to restore the queue on return. */
export interface QueueContext {
  qs: string;
  scrollY: number;
  selectedId: string | null;
}
export const EMPTY_CONTEXT: QueueContext = {
  qs: "",
  scrollY: 0,
  selectedId: null,
};

/** Scroll and selection only restore when the queue is showing the same query that was saved. */
export function restorableContext(
  ctx: QueueContext,
  currentQs: string,
): { scrollY: number; selectedId: string | null } | null {
  if (ctx.qs !== currentQs) return null;
  if (ctx.scrollY <= 0 && !ctx.selectedId) return null;
  return { scrollY: ctx.scrollY, selectedId: ctx.selectedId };
}

export function queueHref(personaId: string, qs: string): string {
  return `/proto/${personaId}/money/dockets${qs ? `?${qs}` : ""}`;
}

export function formatCents(cents: number | null): string {
  if (cents === null) return "Missing";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}
