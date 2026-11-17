import { addDays } from "../../fixtures/time";
import type { ShiftRecord } from "../../types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MON_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parts(ymd: string) {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, dow };
}

/** "Fri 20 Nov" (the app date format; never ISO). */
export function fmtDay(ymd: string): string {
  const p = parts(ymd);
  return `${DOW[p.dow]} ${p.d} ${MON[p.m - 1]}`;
}
/** "Friday 20 November". */
export function fmtDayLong(ymd: string): string {
  const p = parts(ymd);
  return `${DOW_LONG[p.dow]} ${p.d} ${MON_LONG[p.m - 1]}`;
}
/** "Fri" and "20". */
export function dayParts(ymd: string): { dow: string; day: string } {
  const p = parts(ymd);
  return { dow: DOW[p.dow] as string, day: String(p.d) };
}

/** "22:00" -> "10:00 pm". One 12-hour format everywhere. */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Local wall-clock "YYYY-MM-DDTHH:mm" split. */
export function splitWall(w: string): { date: string; time: string } {
  const [date, time] = w.split("T");
  return { date: date as string, time: (time as string).slice(0, 5) };
}
export function joinWall(date: string, time: string): string {
  return `${date}T${time}`;
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
export function weekLabel(weekStart: string): string {
  return `${fmtDay(weekStart)} to ${fmtDay(addDays(weekStart, 6))}`;
}

export function endsNextDay(s: Pick<ShiftRecord, "start" | "end">): boolean {
  return splitWall(s.end).date > splitWall(s.start).date;
}

/** Build start/end wall-clock strings from form fields. Overnight = ends on the day after the start day. */
export function composeTimes(f: {
  startDay: string;
  startTime: string;
  endTime: string;
  nextDay: boolean;
}): { start: string; end: string } {
  return {
    start: joinWall(f.startDay, f.startTime),
    end: joinWall(f.nextDay ? addDays(f.startDay, 1) : f.startDay, f.endTime),
  };
}

/** "10:00 pm to 6:00 am". */
export function shiftRange(s: Pick<ShiftRecord, "start" | "end">): string {
  return `${fmtTime(splitWall(s.start).time)} to ${fmtTime(splitWall(s.end).time)}`;
}

/** Full wording with dates when the shift crosses midnight: "Fri 20 Nov 10:00 pm to Sat 21 Nov 6:00 am". */
export function shiftWithDates(s: Pick<ShiftRecord, "start" | "end">): string {
  const a = splitWall(s.start);
  const b = splitWall(s.end);
  if (a.date === b.date)
    return `${fmtDay(a.date)}, ${fmtTime(a.time)} to ${fmtTime(b.time)}`;
  return `${fmtDay(a.date)} ${fmtTime(a.time)} to ${fmtDay(b.date)} ${fmtTime(b.time)}`;
}

const byStart = (a: ShiftRecord, b: ShiftRecord) =>
  a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : 1;

/** Shifts belong to the day they START on (overnight shifts stay on their start day). */
export function shiftsStartingOn(
  shifts: ShiftRecord[],
  ymd: string,
): ShiftRecord[] {
  return shifts.filter((s) => splitWall(s.start).date === ymd).sort(byStart);
}

/** Overnight shifts from the previous day that are still running after midnight on `ymd`. */
export function shiftsContinuingOnto(
  shifts: ShiftRecord[],
  ymd: string,
): ShiftRecord[] {
  return shifts
    .filter((s) => {
      const a = splitWall(s.start);
      const b = splitWall(s.end);
      return (
        a.date < ymd && b.date >= ymd && !(b.date === ymd && b.time === "00:00")
      );
    })
    .sort(byStart);
}

/** Quarter-hour options for time pickers. */
export function timeOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 15) {
      const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      out.push({ value: v, label: fmtTime(v) });
    }
  return out;
}
