import { formatDay } from "@/server/format";

/** `2026-11-16`: the calendar day of a moment in the venue's time zone. Only for grouping what is shown. */
export function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export type DayGroup<T> = { key: string; label: string; items: T[] };

/** Group things that have a `start` by the day they start, earliest day first. */
export function groupByDay<T extends { start: string }>(
  items: T[],
  timeZone: string,
): DayGroup<T>[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  const groups: DayGroup<T>[] = [];
  for (const item of sorted) {
    const key = dayKey(item.start, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else
      groups.push({
        key,
        label: formatDay(item.start, timeZone),
        items: [item],
      });
  }
  return groups;
}

type OfferLike = {
  mode: string;
  mine: boolean;
  my_claim: { decision: string | null } | null;
};

/** What an offered shift means for this person, in plain words. */
export function offerState(offer: OfferLike): string {
  if (offer.mine)
    return "You put this shift up. It stays yours until a colleague is given it.";
  if (offer.my_claim) {
    if (offer.my_claim.decision === null)
      return "You asked for this shift. Waiting for your manager to decide.";
    if (offer.my_claim.decision === "approved") return "This shift is yours.";
    return "Not this time. Your manager gave it to someone else.";
  }
  return offer.mode === "first_come"
    ? "First to claim gets it. It is yours as soon as you tap Claim."
    : "Tap Claim to ask for it. Your manager decides who gets it.";
}

const OUTCOME_WORDS: Record<string, string> = {
  waiting: "Waiting for a manager",
  got_it: "You got this shift",
  not_this_time: "Someone else got this shift",
  offer_withdrawn: "This offer was taken back",
};

/** The backend's `my_outcome` in plain words; null when there is no claim (or a word this screen does not know). */
export function outcomeWords(
  outcome: string | null | undefined,
): string | null {
  return outcome ? (OUTCOME_WORDS[outcome] ?? null) : null;
}
