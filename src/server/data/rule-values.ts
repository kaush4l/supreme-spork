/**
 * Roster rules are drawn from what the backend describes. Choices can be text, numbers or yes/no, but a form holds
 * text, so each value is written as text in a draft and read back to its real type when saved. Pure: tested.
 */
export type RuleValue = string | number | boolean;

export type RuleShape = {
  kind: string;
  value: RuleValue;
  min?: number;
  max?: number;
};

/** The text a form holds for a rule's current value. Choices keep their type as JSON ("48", "\"none\"", "true"). */
export function toDraft(rule: RuleShape): string {
  if (rule.kind === "choice" || rule.kind === "yesno")
    return JSON.stringify(rule.value);
  return String(rule.value);
}

/** The value to send for a draft, or `"invalid"` when a number is not a whole number in the allowed range. */
export function fromDraft(
  rule: RuleShape,
  draft: string,
): RuleValue | "invalid" {
  if (rule.kind === "choice" || rule.kind === "yesno") {
    try {
      return JSON.parse(draft) as RuleValue;
    } catch {
      return "invalid";
    }
  }
  if (rule.kind === "number_or_off" && draft === "off") return "off";
  if (!/^\d{1,6}$/.test(draft.trim())) return "invalid";
  const n = Number(draft);
  if (rule.min !== undefined && n < rule.min) return "invalid";
  if (rule.max !== undefined && n > rule.max) return "invalid";
  return n;
}

/** Only the rules whose draft differs from what was saved, as `{key: value}` ready to send. */
export function changesFrom(
  rules: (RuleShape & { key: string })[],
  drafts: Record<string, string>,
): { changes: Record<string, RuleValue>; bad: string[] } {
  const changes: Record<string, RuleValue> = {};
  const bad: string[] = [];
  for (const rule of rules) {
    const draft = drafts[rule.key];
    if (draft === undefined || draft === toDraft(rule)) continue;
    const value = fromDraft(rule, draft);
    if (value === "invalid") bad.push(rule.key);
    else changes[rule.key] = value;
  }
  return { changes, bad };
}
