import { formatMoney } from "@/server/format";

/** Fields that are plumbing, not evidence a person can read. */
const HIDDEN = new Set([
  "venue_id",
  "supersedes_id",
  "extraction_id",
  "user_id",
  "set_by",
  "entered_by",
  "job_run_id",
  "message_id",
  "narration_model",
  "narration_prompt_version",
]);

export type Line = { label: string; value: string };

export function humanLabel(key: string): string {
  const text = key
    .replace(/_cents$/, "")
    .replace(/_pct$/, " percent")
    .replace(/_/g, " ")
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One scalar as the backend sent it; amounts in cents become money, nothing is worked out. */
export function showValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key.endsWith("_cents") && Number.isInteger(value))
      return formatMoney(value);
    return String(value);
  }
  if (typeof value === "string") {
    if (value === "") return null;
    if (key.endsWith("_pct")) return `${value}%`;
    return value;
  }
  return null;
}

/** Walk a facts tree into labelled lines; lists of things are numbered. */
export function factLines(value: unknown, path: string[] = []): Line[] {
  if (value === null || value === undefined) return [];
  const key = path[path.length - 1] ?? "";
  const label = path.map(humanLabel).join(" / ");
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object" || v === null)) {
      const parts = value
        .map((v) => showValue(key, v))
        .filter((v): v is string => v !== null);
      return parts.length ? [{ label, value: parts.join(", ") }] : [];
    }
    return value.flatMap((v, i) =>
      factLines(v, [...path.slice(0, -1), `${key} ${i + 1}`]),
    );
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      HIDDEN.has(k) ? [] : factLines(v, [...path, k]),
    );
  }
  const shown = showValue(key, value);
  return shown === null ? [] : [{ label, value: shown }];
}

/** Groups in the words a person uses. */
export const GROUP_WORDS: Record<string, string> = {
  purchases: "Purchases",
  waste_entries: "Waste",
  sales: "Sales",
  shifts: "Shifts",
  transactions: "Bank rows",
  bills: "Bills",
  certificates: "Certificates",
  work_limits: "Work limits",
  recipes: "Recipes",
  findings: "Other findings",
  expiry_items: "Expiry items",
  issued_lists: "Checklists",
  list_answers: "Checklist answers",
};

export function groupWords(group: string): string {
  return GROUP_WORDS[group] ?? humanLabel(group);
}
