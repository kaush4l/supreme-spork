/** What the page hands to the client components: already formatted in the venue's time zone, nothing to compute. */
export type ShiftView = {
  id: string;
  position: string;
  staffId: string | null;
  who: string;
  span: string;
  /** `YYYY-MM-DDTHH:mm` venue-local, for the edit form. */
  startInput: string;
  endInput: string;
  breakMinutes: number;
  published: boolean;
  warnings: { kind: string; message: string }[];
};

export type DayView = { date: string; label: string; shifts: ShiftView[] };

export type PersonOption = { id: string; name: string };
