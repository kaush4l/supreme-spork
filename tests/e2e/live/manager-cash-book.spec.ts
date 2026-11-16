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

/** A day in 2024-2025 that an earlier run is unlikely to have used (the till count is one per day). */
function pastDay(): string {
  return new Date(Date.UTC(2024, 0, 1 + Math.floor(Math.random() * 700)))
    .toISOString()
    .slice(0, 10);
}

async function chooseKind(
  page: Page,
  name: "Wages to a person" | "Petty cash",
) {
  await page.getByRole("combobox", { name: /^What kind of payment/ }).click();
  await page.getByRole("option", { name, exact: true }).click();
}

test("a manager records a petty payment (a double click writes once) and a wages payment, and the list shows them", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  const petty = unique("Petty ice");
  const wages = unique("Wages note");

  await openVenuePage(mgr.page, mgr.venue, "cash-book/new");
  await slow(
    mgr.page.getByRole("heading", { name: "Add cash paid out", level: 1 }),
  ).toBeVisible();
  await chooseKind(mgr.page, "Petty cash");
  await mgr.page.getByLabel(/^Amount/).fill("12.50");
  await mgr.page.getByLabel(/^What was it for/).fill(petty);
  await mgr.page.getByRole("button", { name: "Save payment" }).dblclick();
  await mgr.page.waitForURL(/\/cash-book$/, { timeout: 30_000 });
  await slow(
    mgr.page.getByRole("link", { name: `Petty cash: ${petty}` }),
  ).toHaveCount(1);

  await openVenuePage(mgr.page, mgr.venue, "cash-book/new");
  await chooseKind(mgr.page, "Wages to a person");
  await mgr.page.getByLabel(/^Amount/).fill("150");
  await mgr.page.getByRole("button", { name: /^Who was paid/ }).click();
  await mgr.page.getByRole("option", { name: /Priya/ }).first().click();
  await mgr.page.getByLabel(/^Note/).fill(wages);
  await mgr.page.getByRole("button", { name: "Save payment" }).click();
  await mgr.page.waitForURL(/\/cash-book$/, { timeout: 30_000 });
  await slow(
    mgr.page.getByRole("link", { name: /^Wages to Priya/ }).first(),
  ).toBeVisible();

  // The unconfirmed filter shows wages waiting to be confirmed, not the petty one.
  await openVenuePage(mgr.page, mgr.venue, "cash-book?unconfirmed=true");
  await slow(
    mgr.page.getByRole("link", { name: /^Wages to Priya/ }).first(),
  ).toBeVisible();
  await expect(
    mgr.page.getByRole("link", { name: `Petty cash: ${petty}` }),
  ).toHaveCount(0);
  await slow(
    mgr.page.getByText(/waiting to be confirmed/).first(),
  ).toBeVisible();
  await mgr.context.close();
  watch.expectNone();
});

test("a manager cancels a payment with a reason and it stays listed as cancelled", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  const petty = unique("Petty cancel");
  const reason = unique("Entered twice");

  await openVenuePage(mgr.page, mgr.venue, "cash-book/new");
  await chooseKind(mgr.page, "Petty cash");
  await mgr.page.getByLabel(/^Amount/).fill("5");
  await mgr.page.getByLabel(/^What was it for/).fill(petty);
  await mgr.page.getByRole("button", { name: "Save payment" }).click();
  await mgr.page.waitForURL(/\/cash-book$/, { timeout: 30_000 });
  await mgr.page.getByRole("link", { name: `Petty cash: ${petty}` }).click();
  await slow(
    mgr.page.getByRole("heading", { name: `Petty cash: ${petty}`, level: 1 }),
  ).toBeVisible();
  // The button stays off until a reason is typed.
  await expect(
    mgr.page.getByRole("button", { name: "Cancel this payment" }),
  ).toBeDisabled();
  await mgr.page.getByLabel(/^Why is this payment cancelled/).fill(reason);
  await mgr.page.getByRole("button", { name: "Cancel this payment" }).click();
  await slow(mgr.page.getByText(`Cancelled: ${reason}`)).toBeVisible();
  await slow(mgr.page.getByText("Status: Cancelled")).toBeVisible();
  await mgr.context.close();
  watch.expectNone();
});

test("a manager saves a till count and it is listed, with the API's own words about the check", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  const note = unique("Till note");
  const day = pastDay();

  await openVenuePage(mgr.page, mgr.venue, "cash-book/till");
  await slow(
    mgr.page.getByRole("heading", { name: "Till counts", level: 1 }),
  ).toBeVisible();
  await mgr.page.getByLabel(/^Day counted/).fill(day);
  await mgr.page.getByLabel(/^Counted in the till/).fill("480.50");
  await mgr.page.getByLabel(/^Float left/).fill("200");
  await mgr.page.getByLabel(/^Note/).fill(note);
  await mgr.page.getByRole("button", { name: "Save count" }).click();
  await slow(mgr.page.getByText(/^Saved\./)).toBeVisible();
  // The list holds the day, and the note (a past day may be on a later page of a long list, so look it up by its page).
  await slow(mgr.page.getByText(`Note: ${note}`).first()).toBeVisible();
  await expect(mgr.page.getByText(day).first()).toBeVisible();
  await mgr.context.close();
  watch.expectNone();
});

test("the summary opens with a range form and the CSV downloads as text/csv", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "cash-book/summary");
  await slow(
    mgr.page.getByRole("heading", { name: "Cash book summary", level: 1 }),
  ).toBeVisible();
  await slow(mgr.page.getByLabel("From", { exact: true })).toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await slow(
    mgr.page.getByRole("heading", { name: /^Paid out, / }),
  ).toBeVisible();
  await slow(
    mgr.page
      .getByRole("columnheader", { name: "Cash paid minus cost" })
      .or(mgr.page.getByText(/Nobody worked or was paid cash/)),
  ).toBeVisible();

  const link = mgr.page.getByRole("link", { name: /Download cash wages/ });
  await slow(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/cash-book\/summary\/csv\?from=.*&to=/);
  const csv = await mgr.page.request.get(href as string);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toMatch(/text\/csv/);
  expect(await csv.text()).toMatch(/^paid_on,name,staff_ref/);

  // A backwards range falls back to the current week, not an error page.
  await openVenuePage(
    mgr.page,
    mgr.venue,
    "cash-book/summary?from=2026-11-10&to=2026-11-02",
  );
  await slow(
    mgr.page.getByRole("heading", { name: "Cash book summary", level: 1 }),
  ).toBeVisible();
  await mgr.context.close();
  watch.expectNone();
});

test("staff cannot open the cash book or its CSV", async ({ browser }) => {
  const staff = await as(browser, "staff");
  for (const path of [
    "cash-book",
    "cash-book/new",
    "cash-book/till",
    "cash-book/summary",
  ]) {
    await staff.page.goto(`/venues/${staff.venue}/${path}`);
    await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  }
  const csv = await staff.page.request.get(
    `/venues/${staff.venue}/cash-book/summary/csv?from=2026-11-02&to=2026-11-08`,
  );
  expect([403, 404]).toContain(csv.status());
  await staff.context.close();
});

test("a bookkeeper reads the list and the summary but has no add button, no form and no till form", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await openVenuePage(bk.page, bk.venue, "cash-book");
  await slow(
    bk.page.getByRole("heading", { name: "Cash book", level: 1 }),
  ).toBeVisible();
  await expect(
    bk.page.getByRole("link", { name: "Add cash paid out" }),
  ).toHaveCount(0);
  await slow(bk.page.getByRole("link", { name: "Till counts" })).toBeVisible();
  await bk.page.goto(`/venues/${bk.venue}/cash-book/new`);
  await slow(bk.page.getByText(NOT_FOUND).first()).toBeVisible();
  await openVenuePage(bk.page, bk.venue, "cash-book/till");
  await slow(
    bk.page.getByRole("heading", { name: "Till counts", level: 1 }),
  ).toBeVisible();
  await expect(bk.page.getByRole("button", { name: "Save count" })).toHaveCount(
    0,
  );
  await openVenuePage(bk.page, bk.venue, "cash-book/summary");
  await slow(
    bk.page.getByRole("heading", { name: "Cash book summary", level: 1 }),
  ).toBeVisible();
  await bk.context.close();
});
