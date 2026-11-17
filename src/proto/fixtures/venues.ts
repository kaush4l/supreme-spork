import type { Venue } from "../types";

export const venues: Venue[] = [
  { id: "v-harbour", name: "Harbour Kitchen", timezone: "Australia/Sydney" },
  { id: "v-perth", name: "Swan River Bar", timezone: "Australia/Perth" },
  {
    id: "v-empty",
    name: "Newly Opened Cafe",
    timezone: "Australia/Sydney",
    empty: true,
  },
];

export function getVenue(id: string): Venue {
  const v = venues.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown venue ${id}`);
  return v;
}
