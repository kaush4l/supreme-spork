/** Helpers for the manager roster and board specs (kept here so no other spec depends on them). */
import { expect, type Locator, type Page } from "@playwright/test";

const MONTHS = [
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

/** `2027-03-03` -> `March 3, 2027`, the text the date picker shows and accepts. */
export function pickerDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** `13:05` -> `1:05 PM`. */
export function pickerTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** `13:05` -> `1:05 pm`, the way the screens write a time. */
export function shownTime(hhmm: string): string {
  return pickerTime(hhmm).toLowerCase();
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A Monday far in the future that no earlier run has used (weeks 20..400 after 2027-03-01). */
export function farWeek(): string {
  return addDaysIso("2027-03-01", 7 * (20 + Math.floor(Math.random() * 380)));
}

/** The Monday of next week (UTC) from now, so a shift on its Tuesday is inside the staff 14-day window. */
export function nextWeekMonday(): string {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  return addDaysIso(now.toISOString().slice(0, 10), 7 - day);
}

export async function openRoster(page: Page, venue: string, week?: string) {
  await page.goto(`/venues/${venue}/roster${week ? `?week=${week}` : ""}`);
  await expect(
    page.getByRole("heading", { name: "Roster", level: 1 }),
  ).toBeVisible();
}

export type ShiftForm = {
  position?: string;
  who?: string; // a person's name; omitted keeps the dialog default (open)
  startDate?: string;
  startTime?: string; // HH:mm
  endDate?: string;
  endTime?: string;
};

async function typeInto(input: Locator, text: string) {
  await input.fill(text);
  await input.press("Enter");
}

/** Fill the open shift dialog the way a person would: choose from the pickers and type into the date and time boxes. */
export async function fillShift(page: Page, f: ShiftForm) {
  const d = page.getByRole("dialog");
  if (f.position) {
    await d.locator("button[role=combobox]").click();
    await page.getByRole("option", { name: f.position, exact: true }).click();
  }
  if (f.who) {
    await d.getByRole("button", { name: /^Who works it/ }).click();
    await page.getByRole("option", { name: f.who, exact: true }).click();
  }
  const dates = d.locator('input[placeholder="Select a date"]');
  if (f.startDate) await typeInto(dates.nth(0), pickerDate(f.startDate));
  if (f.startTime)
    await typeInto(
      d.getByLabel("Starts (venue time) time"),
      pickerTime(f.startTime),
    );
  if (f.endDate) await typeInto(dates.nth(1), pickerDate(f.endDate));
  if (f.endTime)
    await typeInto(
      d.getByLabel("Ends (venue time) time"),
      pickerTime(f.endTime),
    );
}

/** Open the add dialog, fill it, press the button. Returns the dialog so a caller can read an error. */
export async function addShift(page: Page, f: ShiftForm) {
  await page.getByRole("button", { name: "Add a shift" }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByText("Add a shift").first()).toBeVisible();
  await fillShift(page, f);
  await d.getByRole("button", { name: "Add shift" }).click();
  return d;
}

/** The card of the shift shown with this time span (its own container, which holds one Edit button). */
export function shiftCard(page: Page, span: string): Locator {
  return page
    .getByText(span, { exact: true })
    .locator("xpath=ancestor::div[.//button[normalize-space()='Edit']][1]");
}

export async function noSideScroll(page: Page) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(wide, "horizontal overflow in px").toBeLessThanOrEqual(0);
}
