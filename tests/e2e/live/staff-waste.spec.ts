import { expect, type Page, test } from "@playwright/test";
import { openVenuePage, signIn, skipUnlessLive, unique } from "../support/live";

skipUnlessLive();
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
const expectSoon = expect.configure({ timeout: 20_000 });
const NOT_FOUND = /could not be found|not found/i;

const managerNote = unique("waste-manager");
const staffNote = unique("waste-staff");
let venue = "";
let managerEntryHref = "";

/** Fill the record form and save it; clicks Save twice quickly to prove a double tap writes once. */
async function record(page: Page, note: string, item: string, qty: string) {
  await page.getByRole("button", { name: /What was thrown away/ }).click();
  await page.getByPlaceholder("Type a name").fill(item);
  await page
    .getByRole("option", { name: new RegExp(item) })
    .first()
    .click();
  await page.getByRole("spinbutton", { name: /How much/ }).fill(qty);
  await page.getByRole("combobox", { name: /Why/ }).click();
  await page.getByRole("option", { name: "Spoiled" }).click();
  await page.getByLabel("Note").fill(note);
  const save = page.getByRole("button", { name: "Save waste" });
  await save.dblclick();
  await expectSoon(page.getByText("Saved.")).toBeVisible();
}

test("a manager records waste once, sees it listed, and reads the report", async ({
  page,
}) => {
  venue = await signIn(page, "manager");
  await openVenuePage(page, venue, "waste");
  await expectSoon(
    page.getByRole("heading", { name: "Waste", level: 1 }),
  ).toBeVisible();
  await record(page, managerNote, "Tiramisu", "2");
  await expectSoon(page.getByText(managerNote)).toHaveCount(1);
  const link = page
    .getByText(managerNote)
    .locator("xpath=ancestor::*[.//a[contains(@href,'/waste/')]][1]")
    .locator("a")
    .first();
  managerEntryHref = (await link.getAttribute("href")) ?? "";
  expect(managerEntryHref).toMatch(/\/waste\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "See what waste cost" }).click();
  await expectSoon(
    page.getByRole("heading", { name: "Waste report", level: 1 }),
  ).toBeVisible();
  await expectSoon(
    page.getByText(/Cost is the median docket price/),
  ).toBeVisible();
  await expectSoon(
    page.getByText(/Tiramisu: \$[\d,]+\.\d\d/).first(),
  ).toBeVisible();
});

test("the report takes a date range and keeps asking nothing it cannot answer", async ({
  page,
}) => {
  await signIn(page, "manager");
  await openVenuePage(page, venue, "waste/report");
  await page.getByRole("textbox", { name: "From" }).fill("2026-11-02");
  await page
    .getByRole("textbox", { name: "To", exact: true })
    .fill("2026-11-08");
  await page.getByRole("button", { name: "Show" }).click();
  await expectSoon(page).toHaveURL(/from=2026-11-02&to=2026-11-08/);
  await expectSoon(
    page.getByText(/2026-11-02 to 2026-11-08/).first(),
  ).toBeVisible();
});

test("staff record their own waste, do not see the manager's, and the report is not found", async ({
  page,
}) => {
  await signIn(page, "staff");
  await openVenuePage(page, venue, "waste");
  await expectSoon(
    page.getByRole("heading", { name: "My entries" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See what waste cost" }),
  ).toHaveCount(0);
  await record(page, staffNote, "Tiramisu", "1");
  await expectSoon(page.getByText(staffNote)).toHaveCount(1);
  await expect(page.getByText(managerNote)).toHaveCount(0);

  await openVenuePage(page, venue, "waste/report");
  await expectSoon(page.getByText(NOT_FOUND).first()).toBeVisible();

  await page.goto(managerEntryHref);
  await expectSoon(page.getByText(NOT_FOUND).first()).toBeVisible();
});

test("staff correct and then remove their own entry; the entry id moves on once", async ({
  page,
}) => {
  await signIn(page, "staff");
  await openVenuePage(page, venue, "waste");
  await page
    .getByText(staffNote)
    .locator("xpath=ancestor::*[.//a[contains(@href,'/waste/')]][1]")
    .locator("a")
    .first()
    .click();
  await expectSoon(
    page.getByRole("heading", { name: "Correct this entry" }),
  ).toBeVisible();
  await page.getByRole("spinbutton", { name: /How much/ }).fill("3");
  await page.getByRole("spinbutton", { name: /How much/ }).press("Tab");
  await page.getByRole("button", { name: "Save changes" }).dblclick();
  await expectSoon(page.getByText(/^3 portions, spoiled$/)).toBeVisible();
  await expectSoon(page.getByText(/Corrected by/)).toBeVisible();
  await page.getByRole("button", { name: "Remove entry" }).click();
  await page.getByRole("button", { name: "Yes, remove it" }).click();
  await expectSoon(page).toHaveURL(/\/waste$/);
  await expectSoon(
    page.getByRole("heading", { name: "My entries" }),
  ).toBeVisible();
  await expect(page.getByText(staffNote)).toHaveCount(0);
});

test("the manager sees the manager entry on the detail page and can change it; then removes it", async ({
  page,
}) => {
  await signIn(page, "manager");
  await page.goto(managerEntryHref);
  await expectSoon(page.getByText(`Note: ${managerNote}`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove entry" }).click();
  await page.getByRole("button", { name: "Yes, remove it" }).click();
  await expectSoon(page).toHaveURL(/\/waste$/);
  await expect(page.getByText(managerNote)).toHaveCount(0);
});

test("the bookkeeper reads the list and the report but has no form or buttons", async ({
  page,
}) => {
  await signIn(page, "bookkeeper");
  await openVenuePage(page, venue, "waste");
  await expectSoon(
    page.getByRole("heading", { name: "Entries" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save waste" })).toHaveCount(0);
  await openVenuePage(page, venue, "waste/report");
  await expectSoon(
    page.getByRole("heading", { name: "Waste report", level: 1 }),
  ).toBeVisible();
});

test("the owner's empty Bondi venue shows plain empty states", async ({
  page,
}) => {
  await signIn(page, "owner");
  await page.goto("/");
  const href = await page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: "Bondi" })
    .first()
    .getAttribute("href");
  const bondi = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1] ?? "";
  expect(bondi).toBeTruthy();
  await openVenuePage(page, bondi, "waste");
  await expectSoon(
    page.getByText(/Nothing has been thrown away/),
  ).toBeVisible();
  await openVenuePage(page, bondi, "waste/report");
  await expectSoon(
    page.getByText(/Nothing was thrown away between/),
  ).toBeVisible();
});
