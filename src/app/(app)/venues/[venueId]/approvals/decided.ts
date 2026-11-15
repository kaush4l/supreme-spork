/** Plain words for the "Recently decided" list. The backend says what was decided and by whom; this only words it. */

const REQUEST_WORDS: Record<string, string> = {
  approved: "Approved",
  rejected: "Not approved",
  expired: "Expired",
};

/** `Approved by Maya Chen`, or just `Approved` when the backend names nobody. */
export function requestOutcome(status: string, by: string | null | undefined) {
  const word = REQUEST_WORDS[status] ?? status;
  return by ? `${word} by ${by}` : word;
}

type OfferLike = {
  status: string;
  mode?: string;
  filled_by?: string | null;
  decided_by_name?: string | null;
};

/** What became of a shift offer: given to someone (by a manager or first come), or taken back. */
export function offerOutcome(offer: OfferLike): string {
  if (offer.status === "withdrawn") return "Offer taken back";
  const who = offer.filled_by ?? "Someone";
  if (offer.decided_by_name)
    return `Given to ${who} by ${offer.decided_by_name}`;
  return offer.mode === "first_come"
    ? `Taken by ${who} (first come)`
    : `Given to ${who}`;
}

export type DecidedItem = {
  id: string;
  title: string;
  outcome: string;
  at: string;
};

/** Newest first. */
export function newestFirst(items: DecidedItem[]): DecidedItem[] {
  return [...items].sort((a, b) => b.at.localeCompare(a.at));
}
