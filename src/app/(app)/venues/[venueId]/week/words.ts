/** Friendly words for the status words the summary sends (the figures' own notes come from the API). */
const FIGURE: Record<string, string> = {
  complete: "Complete",
  missing: "Missing",
  partial: "Partly there",
  incomplete: "Partly there",
};

export function figureWords(status: string): string {
  return FIGURE[status] ?? status.replace(/_/g, " ");
}

const TARGET: Record<string, string> = {
  over: "over the target",
  under: "within the target",
  unknown: "not known yet",
};

export function targetWords(vs: string): string {
  return TARGET[vs] ?? vs;
}
