/** The three groups, in the order the backend sorts them. The heading words are ours; the grouping key is the backend's. */
export const SEVERITIES = [
  { key: "act_now", heading: "Do now" },
  { key: "soon", heading: "Soon" },
  { key: "watch", heading: "Keep an eye on" },
] as const;

const ROLE_WORDS: Record<string, string> = {
  owner: "owner",
  partner: "partner",
  manager: "manager",
  bookkeeper: "bookkeeper",
};

/** "For: owner, partner, manager" */
export function whoWords(who: readonly string[]): string {
  return `For: ${who.map((r) => ROLE_WORDS[r] ?? r).join(", ")}`;
}

/** The label for the backend's `since`, from the `since_kind` the backend sends. */
export function sinceLabel(item: { since_kind?: string | null }): string {
  if (item.since_kind === "due") return "Due";
  if (item.since_kind === "expires") return "Expiry date";
  return "Waiting since";
}
