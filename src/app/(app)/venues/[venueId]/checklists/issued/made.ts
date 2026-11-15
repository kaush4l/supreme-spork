export type Made = {
  weekStart: string;
  shifts: number;
  issued: number;
  alreadyIssued: number;
};

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** What "Issue lists now" answered, in plain words. Every number is the backend's. */
export function madeWords(m: Made): string {
  if (m.shifts === 0)
    return `Nothing to do: no filled shifts in the published week starting ${m.weekStart}, or no rules.`;
  return `Made ${plural(m.issued, "new list", "new lists")} for the week starting ${m.weekStart} (${plural(m.shifts, "shift", "shifts")}). ${m.alreadyIssued} ${m.alreadyIssued === 1 ? "was" : "were"} already there.`;
}
