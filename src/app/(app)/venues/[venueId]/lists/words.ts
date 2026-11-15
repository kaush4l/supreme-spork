/** Plain words for list statuses, progress and ranges. Only wording: every number comes from the backend. */

export const LIST_WORDS: Record<string, string> = {
  open: "To do",
  overdue: "Overdue",
  missed: "Not done",
  done: "Done",
};

export const statusWord = (status: string): string =>
  LIST_WORDS[status] ?? status;

export type ProgressLike = {
  items: number;
  answered: number;
  required: number;
  required_answered: number;
  not_applicable: number;
  out_of_range: number;
};

/** `3 of 5 done`, then only the extras that apply. */
export function progressWords(p: ProgressLike): string {
  const parts = [`${p.answered} of ${p.items} done`];
  if (p.required > 0)
    parts.push(`${p.required_answered} of ${p.required} required`);
  if (p.not_applicable > 0) parts.push(`${p.not_applicable} not applicable`);
  if (p.out_of_range > 0)
    parts.push(
      p.out_of_range === 1
        ? "1 reading outside range"
        : `${p.out_of_range} readings outside range`,
    );
  return parts.join(", ");
}

/** `2 to 8`, `at least 2`, `at most 8`, or null when the item has no range. */
export function rangeWords(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const lo = min ?? null;
  const hi = max ?? null;
  if (lo !== null && hi !== null) return `${lo} to ${hi}`;
  if (lo !== null) return `at least ${lo}`;
  if (hi !== null) return `at most ${hi}`;
  return null;
}

/** `5 min late`, `1 h 5 min late`, `2 h late`. */
export function lateWords(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min late`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h late` : `${h} h ${rest} min late`;
}

const ORDER: Record<string, number> = {
  overdue: 0,
  missed: 1,
  open: 2,
  done: 3,
};

/** Overdue first, then not done, to do, done; otherwise the backend's order is kept. */
export function overdueFirst<T extends { status: string }>(lists: T[]): T[] {
  return lists
    .map((l, i) => ({ l, i }))
    .sort(
      (a, b) =>
        (ORDER[a.l.status] ?? 9) - (ORDER[b.l.status] ?? 9) || a.i - b.i,
    )
    .map((x) => x.l);
}

/** My lists in three groups: to do (overdue first), not done, done. */
export function groupMyLists<T extends { status: string }>(lists: T[]) {
  const sorted = overdueFirst(lists);
  return [
    {
      title: "To do",
      lists: sorted.filter(
        (l) => l.status === "overdue" || l.status === "open",
      ),
    },
    { title: "Not done", lists: sorted.filter((l) => l.status === "missed") },
    { title: "Done", lists: sorted.filter((l) => l.status === "done") },
  ].filter((g) => g.lists.length > 0);
}
