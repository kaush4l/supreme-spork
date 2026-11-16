/** The kinds of exception the API sends, in the order a manager works through them, with plain headings. */
export const KIND_ORDER = [
  "missing_out",
  "no_show",
  "late_in",
  "early_out",
  "over_plan",
  "unrostered",
  "long_session",
  "no_rate",
] as const;

const WORDS: Record<string, string> = {
  no_show: "No show",
  missing_out: "Still clocked in",
  late_in: "Late in",
  early_out: "Early out",
  over_plan: "Over the plan",
  unrostered: "Not on the roster",
  long_session: "Very long session",
  no_rate: "No pay rate",
};

export function kindWords(kind: string): string {
  return WORDS[kind] ?? kind.replace(/_/g, " ");
}

/** Group rows by kind in the working order; kinds this page does not know come last. Only groups, no counting. */
export function groupByKind<T extends { kind: string }>(
  rows: T[],
): { kind: string; rows: T[] }[] {
  const known: string[] = [...KIND_ORDER];
  const extra = [...new Set(rows.map((r) => r.kind))].filter(
    (k) => !known.includes(k),
  );
  return [...known, ...extra]
    .map((kind) => ({ kind, rows: rows.filter((r) => r.kind === kind) }))
    .filter((g) => g.rows.length > 0);
}

/** `-240` shows as "-240 min", `15` as "+15 min", as the API sent it. */
export function minutesWords(n: number): string {
  return `${n > 0 ? "+" : ""}${n} min`;
}
