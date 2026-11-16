import type { ActionState } from "@/server/data/corrective";

/** The states a person can filter by, in the order shown. */
export const STATE_FILTERS: { state: ActionState; label: string }[] = [
  { state: "open", label: "Open" },
  { state: "done", label: "Done" },
  { state: "cancelled", label: "Cancelled" },
  { state: "all", label: "All" },
];

/** The filter from the address bar; anything unknown is the default, open. */
export function pickState(value: string | undefined): ActionState {
  return STATE_FILTERS.find((f) => f.state === value)?.state ?? "open";
}

/** A follow-up's state in plain words. */
export function stateWords(state: string): string {
  if (state === "open") return "Open";
  if (state === "done") return "Done";
  if (state === "cancelled") return "Cancelled";
  return state;
}

/** What failed, in plain words, from the kind the backend sends. */
export function kindWords(kind: string): string {
  if (kind === "out_of_range") return "A reading was outside its limits";
  if (kind === "list_missed") return "A checklist was not finished in time";
  return "A check failed";
}

/** The Follow-up cell of the readings log. */
export function followUpWords(state: string | null | undefined): string {
  if (!state) return "";
  if (state === "open") return "Follow-up open";
  if (state === "done") return "Follow-up done";
  if (state === "cancelled") return "Follow-up cancelled";
  return `Follow-up ${state}`;
}

/** The owner in words: the name, or "Nobody yet". */
export function ownerWords(name: string | null | undefined): string {
  return name?.trim() ? name : "Nobody yet";
}

/** Who closed it and how, for a closed follow-up. */
export function closedWords(
  state: string,
  by: string | null | undefined,
): string {
  const verb = state === "cancelled" ? "Cancelled" : "Marked done";
  return `${verb} by ${by?.trim() ? by : "someone"}`;
}
