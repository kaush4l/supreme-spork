/** Plain words for what the announcements backend sends. Pure: it only turns the API's counts and words into text. */

const STATUS: Record<string, string> = {
  active: "Sent",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export function statusWords(status: string): string {
  return STATUS[status] ?? status;
}

const RECEIPT: Record<string, string> = {
  read: "Read",
  unread: "Not read yet",
  no_login: "No app login",
};

export function receiptWords(state: string): string {
  return RECEIPT[state] ?? state;
}

type Counts = {
  read_count: number;
  told_count: number;
  no_login_count: number;
};

/** "Read by 8 of 11", from the counts the backend sends. */
export function readLine(c: Counts): string {
  if (c.told_count === 0) return "Nobody has an app login to be told.";
  return `Read by ${c.read_count} of ${c.told_count}`;
}

/** "3 have no app login" or null when everyone has one. */
export function noLoginLine(c: Counts): string | null {
  if (c.no_login_count === 0) return null;
  return c.no_login_count === 1
    ? "1 person has no app login, so they were not told."
    : `${c.no_login_count} people have no app login, so they were not told.`;
}

/** Who it is for: "Everyone", or the names the backend gives for the positions, groups or people. */
export function audienceLine(a: {
  audience_kind: string;
  audience_labels: string[];
}): string {
  if (a.audience_kind === "everyone") return "Everyone";
  const kind =
    a.audience_kind === "positions"
      ? "Positions"
      : a.audience_kind === "groups"
        ? "Groups"
        : "People";
  return a.audience_labels.length > 0
    ? `${kind}: ${a.audience_labels.join(", ")}`
    : kind;
}

export const AUDIENCE_KINDS = [
  { value: "everyone", label: "Everyone" },
  { value: "positions", label: "People in some positions" },
  { value: "groups", label: "Some groups" },
  { value: "people", label: "Named people" },
] as const;

export type AudienceKind = (typeof AUDIENCE_KINDS)[number]["value"];

/** What may be sent: a title and a body, and for anything but everyone at least one choice. Returns the sentence to show, or null. */
export function formProblem(f: {
  title: string;
  body: string;
  kind: AudienceKind;
  ids: readonly string[];
}): string | null {
  if (f.title.trim() === "") return "Write a title.";
  if (f.body.trim() === "") return "Write the message.";
  if (f.kind !== "everyone" && f.ids.length === 0)
    return "Choose who this is for.";
  return null;
}
