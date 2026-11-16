import { type Browser, expect, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
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

test("an owner sees the pilot scorecard: a card per measure, the week table and the CSV link", async ({
  browser,
}) => {
  const owner = await as(browser, "owner");
  const watch = watchCsp(owner.page);

  await openVenuePage(owner.page, owner.venue, "pilot");

  // the owner finds it in the navigation
  await expect(
    owner.page.getByRole("link", { name: "Pilot scorecard" }).first(),
  ).toBeAttached();
  await slow(
    owner.page.getByRole("heading", { name: "Pilot scorecard", level: 1 }),
  ).toBeVisible();
  await slow(owner.page.getByText(/^Period: /)).toBeVisible();

  // one card per measure: heading, a status word and the sentence on how it is counted
  await slow(
    owner.page.getByRole("heading", {
      name: "Roster published in the app each week",
      level: 2,
    }),
  ).toBeVisible();
  await expect(
    owner.page.getByRole("heading", { name: "Bugs triaged weekly", level: 2 }),
  ).toBeVisible();
  await expect(
    owner.page.getByText("Tracked outside the app").first(),
  ).toBeVisible();
  await expect(owner.page.getByText(/^Pass mark \d+%$/).first()).toBeVisible();
  await expect(owner.page.getByText(/^Weeks in the period/)).toBeVisible();

  // the week-by-week table
  await expect(
    owner.page.getByRole("heading", { name: "Week by week", level: 2 }),
  ).toBeVisible();
  await expect(
    owner.page.getByRole("columnheader", { name: "Week starting" }),
  ).toBeVisible();
  await expect(owner.page.getByText(/^\d+\/\d+$/).first()).toBeVisible();

  // the CSV link goes through our own route
  await expect(
    owner.page.getByRole("link", { name: "Download CSV" }),
  ).toHaveAttribute("href", new RegExp(`/venues/${owner.venue}/pilot/csv`));

  // a chosen period is kept in the address and shown
  await owner.page.getByLabel("From", { exact: true }).fill("2026-11-09");
  await owner.page.getByLabel("To", { exact: true }).fill("2026-11-15");
  await owner.page.getByRole("button", { name: "Show" }).click();
  await owner.page.waitForURL(/pilot\?from=2026-11-09&to=2026-11-15/);
  await slow(
    owner.page.getByText("Period: 2026-11-09 to 2026-11-15 (1 week)"),
  ).toBeVisible();
  await expect(
    owner.page.getByRole("link", { name: "Download CSV" }),
  ).toHaveAttribute("href", /pilot\/csv\?from=2026-11-09&to=2026-11-15/);

  await owner.context.close();
  watch.expectNone();
});

test("a manager has no pilot scorecard: no navigation entry and the page is not found", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "board");
  await expect(
    mgr.page.getByRole("link", { name: "Roster" }).first(),
  ).toBeAttached(); // the navigation is there
  await expect(
    mgr.page.getByRole("link", { name: "Pilot scorecard" }),
  ).toHaveCount(0);
  await openVenuePage(mgr.page, mgr.venue, "pilot");
  await slow(mgr.page.getByText(NOT_FOUND).first()).toBeVisible();
  await mgr.context.close();
});
