/** Plain words and query handling for the cash book pages. Pure: no numbers are worked out here. */
import { isDay } from "../timesheet/range";

export const KIND_OPTIONS = [
  { value: "wages", label: "Wages to a person" },
  { value: "supplier", label: "Supplier" },
  { value: "petty", label: "Petty cash" },
];

export type Kind = "wages" | "supplier" | "petty";

export function isKind(value: unknown): value is Kind {
  return value === "wages" || value === "supplier" || value === "petty";
}

export function kindLabel(kind: string): string {
  return KIND_OPTIONS.find((k) => k.value === kind)?.label ?? kind;
}

export type ListQuery = {
  kind?: Kind;
  unconfirmed?: boolean;
  from?: string;
  to?: string;
  person?: string;
  supplier?: string;
  offset?: string;
};

export type Filters = {
  kind?: Kind;
  unconfirmed?: boolean;
  from?: string;
  to?: string;
  person?: string;
  supplier?: string;
};

/** The filters in the page's query; anything not valid is dropped. */
export function parseFilters(q: Record<string, unknown>): Filters {
  const text = (v: unknown) =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  const from = isDay(q.from) ? q.from : undefined;
  const to = isDay(q.to) ? q.to : undefined;
  return {
    ...(isKind(q.kind) ? { kind: q.kind } : {}),
    ...(q.unconfirmed === "true" ? { unconfirmed: true } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(text(q.person) ? { person: text(q.person) } : {}),
    ...(text(q.supplier) ? { supplier: text(q.supplier) } : {}),
  };
}

/** The list address for some filters and a page offset. */
export function listHref(venueId: string, f: Filters, offset = 0): string {
  const p = new URLSearchParams();
  if (f.kind) p.set("kind", f.kind);
  if (f.unconfirmed) p.set("unconfirmed", "true");
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.person) p.set("person", f.person);
  if (f.supplier) p.set("supplier", f.supplier);
  if (offset > 0) p.set("offset", String(offset));
  const query = p.toString();
  return `/venues/${venueId}/cash-book${query ? `?${query}` : ""}`;
}

type TitleIn = {
  kind: string;
  payee?: { name: string } | null;
  supplier?: { name: string } | null;
  note?: string | null;
};

/** One line saying what the payment was. */
export function paymentTitle(p: TitleIn): string {
  if (p.kind === "wages") return `Wages to ${p.payee?.name ?? "a person"}`;
  if (p.kind === "supplier") return `Paid ${p.supplier?.name ?? "a supplier"}`;
  return p.note ? `Petty cash: ${p.note}` : "Petty cash";
}

/** "Pay period 2026-11-02 to 2026-11-08", or null when the payment has none. */
export function periodText(p: {
  pay_period_from?: string | null;
  pay_period_to?: string | null;
}): string | null {
  return p.pay_period_from && p.pay_period_to
    ? `Pay period ${p.pay_period_from} to ${p.pay_period_to}`
    : null;
}

/** The status word shown for a payment: the API's own label. */
export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "unconfirmed", label: "Waiting for the person to confirm" },
];
