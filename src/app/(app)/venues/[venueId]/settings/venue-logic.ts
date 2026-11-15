/**
 * Pure helpers for the venue cards. The backend decides what is valid; these only turn what a person typed into what
 * the API takes (percentages are plain numbers: 60 means 60 percent), and describe hours in words.
 */

export type TargetField =
  | "prime_cost_target_pct"
  | "labour_target_pct"
  | "target_margin_pct"
  | "roster_hours_alert";

/** Label, help and limits for each number setting. The API sends none, so these are written from its field descriptions. */
export const NUMBER_FIELDS: {
  key: TargetField;
  label: string;
  help: string;
  unit: string;
  min: number;
  max: number;
  /** The API refuses a value equal to the limit (above 0 and at most 100, or below 100). */
  minExclusive?: boolean;
  maxExclusive?: boolean;
}[] = [
  {
    key: "prime_cost_target_pct",
    label: "Prime cost target",
    help: "Food, drink and wages as a share of sales that you aim to stay under.",
    unit: "%",
    min: 0,
    max: 100,
    minExclusive: true,
  },
  {
    key: "labour_target_pct",
    label: "Wages target",
    help: "Wages as a share of sales that you aim to stay under.",
    unit: "%",
    min: 0,
    max: 100,
    minExclusive: true,
  },
  {
    key: "target_margin_pct",
    label: "Food margin target",
    help: "The margin a dish should make on its price. Used for suggested menu prices.",
    unit: "%",
    min: 0,
    max: 100,
    minExclusive: true,
    maxExclusive: true,
  },
  {
    key: "roster_hours_alert",
    label: "Weekly hours alert",
    help: "Hours rostered in one week above which a person is flagged.",
    unit: "hours",
    min: 1,
    max: 168,
  },
];

/** A number typed in a form, or null when it is not a plain number with at most two decimals inside the limits. */
export function parseNumber(
  draft: string,
  f: (typeof NUMBER_FIELDS)[number],
): number | null {
  const t = draft.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  if (f.minExclusive ? n <= f.min : n < f.min) return null;
  if (f.maxExclusive ? n >= f.max : n > f.max) return null;
  return n;
}

/** `4`, `4:00`, `04:00` become `04:00`; anything else is null. */
export function parseClock(draft: string): string | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(draft.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** `13:30` becomes `1:30 pm`. */
export function clockWords(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export type Day = {
  dow: number;
  day: string;
  set: boolean;
  closed: boolean | null;
  opens: string | null;
  closes: string | null;
};

/** One day in words. The API says closing before opening means after midnight. */
export function dayWords(d: Day): string {
  if (!d.set) return "Not set yet";
  if (d.closed) return "Closed";
  if (!d.opens || !d.closes) return "Not set yet";
  const span = `${clockWords(d.opens)} to ${clockWords(d.closes)}`;
  return d.closes < d.opens
    ? `${span} (closes ${clockWords(d.closes)} the next day)`
    : span;
}

export type DayDraft = { closed: boolean; opens: string; closes: string };

export function toDayDraft(d: Day): DayDraft {
  return {
    closed: d.closed === true,
    opens: d.opens ?? "",
    closes: d.closes ?? "",
  };
}

/** The days that differ from what is saved, in the shape the API takes, and the names of days with a bad time. */
export function hoursChanges(days: Day[], drafts: Record<number, DayDraft>) {
  const changes: {
    dow: number;
    closed: boolean;
    opens?: string;
    closes?: string;
  }[] = [];
  const bad: string[] = [];
  for (const d of days) {
    const draft = drafts[d.dow] ?? toDayDraft(d);
    if (draft.closed) {
      if (!(d.set && d.closed === true))
        changes.push({ dow: d.dow, closed: true });
      continue;
    }
    if (!draft.opens.trim() && !draft.closes.trim()) {
      if (d.set && d.closed !== true) bad.push(d.day); // cleared an open day
      continue;
    }
    const opens = parseClock(draft.opens);
    const closes = parseClock(draft.closes);
    if (!opens || !closes || opens === closes) {
      bad.push(d.day);
      continue;
    }
    if (d.set && d.closed !== true && d.opens === opens && d.closes === closes)
      continue;
    changes.push({ dow: d.dow, closed: false, opens, closes });
  }
  return { changes, bad };
}
