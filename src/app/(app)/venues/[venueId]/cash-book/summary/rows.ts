import { formatHours, formatMoney } from "@/server/format";

export type PersonIn = {
  staff_ref: string;
  name: string;
  hours: number;
  rate_cents?: number | null;
  cost_cents: number;
  incomplete_sessions: number;
  cash_paid_cents: number;
  unconfirmed_cents: number;
  difference_cents: number;
};

export type SummaryRow = {
  id: string;
  name: string;
  hours: string;
  rate: string;
  cost: string;
  cash: string;
  waiting: string;
  difference: string;
};

/** One line of the per-person table: every figure is the API's own number, only formatted. */
export function summaryRow(p: PersonIn): SummaryRow {
  return {
    id: p.staff_ref,
    name:
      p.incomplete_sessions > 0
        ? `${p.name} (${p.incomplete_sessions} unfinished clock-in${p.incomplete_sessions === 1 ? "" : "s"})`
        : p.name,
    hours: formatHours(p.hours),
    rate:
      p.rate_cents == null ? "No rate" : `${formatMoney(p.rate_cents)} an hour`,
    cost: formatMoney(p.cost_cents),
    cash: formatMoney(p.cash_paid_cents),
    waiting: formatMoney(p.unconfirmed_cents),
    difference: formatMoney(p.difference_cents),
  };
}
