/** What a cash payment was for, in plain words. The backend sends `kind` (staff only ever get wages) and an optional note. */
export function paymentFor(p: {
  kind: string;
  note?: string | null;
  pay_period_from?: string | null;
  pay_period_to?: string | null;
}): string {
  const base = p.kind === "wages" ? "Wages" : "Cash payment";
  return p.note && p.note.trim() !== "" ? `${base}: ${p.note.trim()}` : base;
}

const STATUS: Record<string, string> = {
  unconfirmed: "Waiting for you to confirm",
  confirmed: "Confirmed by you",
  cancelled: "Cancelled",
  recorded: "Recorded",
};

/** The status as the person paid reads it ("Waiting for you to confirm"); an unknown status shows the backend's own words. */
export function statusFor(status: string, backendLabel: string): string {
  return STATUS[status] ?? backendLabel;
}
