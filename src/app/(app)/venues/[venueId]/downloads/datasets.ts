/** The datasets `GET /exports/{dataset}` offers, in the API's own words (from its docstring and `exports.py`). */
export const DATASETS = [
  {
    key: "sales",
    title: "Sales",
    help: "Net sales by trading day and channel.",
  },
  {
    key: "purchases",
    title: "Purchases",
    help: "One row for each docket, with the supplier and the GST printed on it.",
  },
  {
    key: "bank",
    title: "Bank rows",
    help: "Every bank row with its category.",
  },
  {
    key: "labour",
    title: "Labour",
    help: "Hours and cost by person for an owner or partner; totals by day for a bookkeeper.",
  },
] as const;

export type DatasetKey = (typeof DATASETS)[number]["key"];

export function isDataset(value: unknown): value is DatasetKey {
  return DATASETS.some((d) => d.key === value);
}
