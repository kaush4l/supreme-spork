/** Small helpers for the template form. Which slot is valid is the backend's call; this only labels and shapes. */

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** The choices for a slot's day: a one-day template has one, a week names the days, two weeks name them twice. */
export function dayOptions(length: number): { value: string; label: string }[] {
  if (length === 1) return [{ value: "0", label: "The day" }];
  return Array.from({ length }, (_, i) => ({
    value: String(i),
    label:
      length === 14
        ? `${WEEKDAYS[i % 7]}, week ${Math.floor(i / 7) + 1}`
        : (WEEKDAYS[i % 7] ?? `Day ${i + 1}`),
  }));
}

export type SlotDraft = {
  key: string;
  day: string;
  position: string;
  start: string;
  end: string;
  count: number;
};

export function emptySlot(key: string): SlotDraft {
  return {
    key,
    day: "0",
    position: "",
    start: "09:00",
    end: "17:00",
    count: 1,
  };
}

/** What the backend takes for each slot. */
export function toPayload(slots: SlotDraft[]) {
  return slots.map((s) => ({
    day: Number(s.day),
    position: s.position,
    start: s.start,
    end: s.end,
    count: s.count,
  }));
}

/** A slot as the backend sent it, ready to edit. */
export function fromTemplate(
  slots: {
    day: number;
    position: string;
    start: string;
    end: string;
    count: number;
  }[],
  newKey: () => string,
): SlotDraft[] {
  return slots.map((s) => ({
    key: newKey(),
    day: String(s.day),
    position: s.position,
    start: s.start,
    end: s.end,
    count: s.count,
  }));
}
