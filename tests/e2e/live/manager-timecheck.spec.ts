import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";
import { watchCsp } from "./manager-ops-helpers";

skipUnlessLive();
test.setTimeout(240_000);
test.use({ actionTimeout: 30_000 });
const slow = expect.configure({ timeout: 25_000 });

const NOT_FOUND = /could not be found|not found/i;

async function as(browser: Browser, role: Role) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const venue = await signIn(page, role);
  return { context, page, venue };
}

/** A day in 2024-2025 that an earlier run is unlikely to have used. */
function pastDay(): string {
  return new Date(Date.UTC(2024, 0, 1 + Math.floor(Math.random() * 700)))
    .toISOString()
    .slice(0, 10);
}

async function noSideScroll(page: Page) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(wide, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

/** A clock-in with no clock-out, on a past day with no shift: it shows as "still clocked in" and "not on the roster". */
async function clockInWithoutOut(page: Page, venue: string, day: string) {
  await openVenuePage(page, venue, "timesheet");
  await page.getByRole("button", { name: /^Person/ }).click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Date", { exact: true }).fill(day);
  await page.getByLabel("Time", { exact: true }).fill("09:00");
  await page.getByLabel(/Why are you adding this/).fill(unique("check hours"));
  await page.getByRole("button", { name: "Add entry" }).click();
  await slow(page.getByText("Entry added.")).toBeVisible();
}

function checkUrl(venue: string, from: string, to: string) {
  return `/venues/${venue}/timesheet/check?from=${from}&to=${to}`;
}

test("the page opens on the current week with a banner, the form and the history", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "timesheet/check");
  await slow(
    mgr.page.getByRole("heading", { name: "Check hours", level: 1 }),
  ).toBeVisible();
  await slow(mgr.page.getByLabel("From", { exact: true })).toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await slow(
    mgr.page
      .getByText(/to look at before pay/)
      .or(mgr.page.getByText("Nothing is waiting")),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("heading", { name: "Mark this period checked" }),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("heading", { name: "Earlier checks" }),
  ).toBeVisible();
  watch.expectNone();
  await mgr.context.close();
});

test("an empty range says nothing is waiting", async ({ browser }) => {
  const mgr = await as(browser, "manager");
  await mgr.page.goto(checkUrl(mgr.venue, "2001-01-01", "2001-01-07"));
  await slow(mgr.page.getByText("Nothing is waiting")).toBeVisible();
  await slow(
    mgr.page.getByText("Nothing to look at between 2001-01-01 and 2001-01-07."),
  ).toBeVisible();
  // a bad hand-made range falls back to the current week, not an error page
  await mgr.page.goto(checkUrl(mgr.venue, "junk", "2001-01-07"));
  await slow(mgr.page.getByLabel("From", { exact: true })).not.toHaveValue(
    "junk",
  );
  await mgr.context.close();
});

test("a clock-in with no clock-out is listed, set aside once with a reason, and shown dimmed with it", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const day = pastDay();
  await clockInWithoutOut(mgr.page, mgr.venue, day);
  await mgr.page.goto(checkUrl(mgr.venue, day, day));

  await slow(
    mgr.page.getByRole("heading", { name: /^Still clocked in/ }),
  ).toBeVisible();
  await slow(
    mgr.page.getByText(/Clocked in but never clocked out/).first(),
  ).toBeVisible();
  await slow(
    mgr.page.getByText(/^Planned \d+ min, worked not known yet/).first(),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("link", { name: "Correct the times" }).first(),
  ).toHaveAttribute("href", new RegExp(`/timesheet\\?from=${day}&to=${day}`));

  // a reason is required
  await mgr.page
    .getByRole("button", { name: "Set aside", exact: true })
    .first()
    .click();
  await mgr.page.getByRole("button", { name: "Save and set aside" }).click();
  await slow(mgr.page.getByText("Say why this is set aside.")).toBeVisible();

  // a double click writes once: one dimmed row with the reason, no error
  const reason = unique("left early, paid by hand");
  await mgr.page.getByLabel("Why is this set aside?").fill(reason);
  await mgr.page.getByRole("button", { name: "Save and set aside" }).dblclick();
  await slow(mgr.page.getByText(`Set aside because: ${reason}`)).toHaveCount(1);
  await expect(
    mgr.page.getByText("Set aside", { exact: true }),
  ).not.toHaveCount(0);
  await mgr.context.close();
});

test("marking a period checked adds it to the history once, with the note", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const note = unique("all fine");
  await mgr.page.goto(checkUrl(mgr.venue, "2001-02-01", "2001-02-07"));
  await mgr.page.getByLabel("Note (optional)").fill(note);
  await mgr.page.getByRole("button", { name: "Mark checked" }).dblclick();
  await slow(mgr.page.getByText("Marked as checked.")).toBeVisible();
  await slow(mgr.page.getByText(`Note: ${note}`)).toHaveCount(1);
  await slow(
    mgr.page
      .getByText(/^2001-02-01 to 2001-02-07, 0 open when checked/)
      .first(),
  ).toBeVisible();
  await mgr.context.close();
});

test("the timesheet page links to the check", async ({ browser }) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "timesheet");
  await slow(
    mgr.page.getByRole("link", { name: "Check hours before a pay run" }),
  ).toHaveAttribute("href", /\/timesheet\/check$/);
  await mgr.context.close();
});

test("staff cannot open the check, unknown ids are not found", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  await staff.page.goto(`/venues/${staff.venue}/timesheet/check`);
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.page.goto("/venues/not-a-uuid/timesheet/check");
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.context.close();
});

test("a bookkeeper has no timesheet right, so the check is not found", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await bk.page.goto(`/venues/${bk.venue}/timesheet/check`);
  await slow(bk.page.getByText(NOT_FOUND).first()).toBeVisible();
  await bk.context.close();
});

test("the check is usable at phone width with no side scroll", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.setViewportSize({ width: 390, height: 844 });
  await openVenuePage(mgr.page, mgr.venue, "timesheet/check");
  await slow(
    mgr.page.getByRole("heading", { name: "Check hours", level: 1 }),
  ).toBeVisible();
  await noSideScroll(mgr.page);
  await mgr.context.close();
});
