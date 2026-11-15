/** Friendly words for the P&L's own codes. The API's sentences are shown as sent; these only name its small fixed sets. */

const STATUS: Record<string, string> = {
  complete: "Complete",
  partial: "Not complete",
  missing: "Missing",
};
export const statusWord = (s: string) => STATUS[s] ?? s;

const SECTION: Record<string, string> = {
  income: "Income",
  cost_of_sales: "Cost of sales",
  labour: "Labour",
  operating: "Other expenses",
  memo: "Shown, but not counted in the result",
};
export const SECTION_ORDER = [
  "income",
  "cost_of_sales",
  "labour",
  "operating",
  "memo",
];
export const sectionWord = (s: string) => SECTION[s] ?? s;

const BASIS: Record<string, string> = {
  accrual: "Counted on the day it happened",
  cash: "Counted on the day the money moved",
};
export const basisWord = (s: string) => BASIS[s] ?? s;

const GROUP: Record<string, string> = {
  sales: "sales rows",
  purchases: "docket lines",
  shifts: "shifts",
  transactions: "bank and statement rows",
  bills: "bills",
};
export const groupWord = (g: string) => GROUP[g] ?? g;
