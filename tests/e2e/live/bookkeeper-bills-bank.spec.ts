import { type Browser, type Page, test } from "@playwright/test";
import { type Role, signIn, skipUnlessLive, unique } from "../support/live";
import {
  demoVenue,
  expect,
  expectNoSideScroll,
  open,
  watch,
} from "./owner-support";

skipUnlessLive();
test.describe.configure({ mode: "serial", timeout: 150_000 });

const errorBanner = (page: Page) => page.locator('div[data-status="error"]');
const NOT_FOUND = /could not be found|not found/i;

async function as(browser: Browser, role: Role) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, role);
  const venue = await demoVenue(page);
  return { context, page, venue };
}

async function bondi(page: Page): Promise<string> {
  await page.goto("/");
  const href = await page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: /Bondi/ })
    .first()
    .getAttribute("href");
  const id = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1];
  expect(id, "the Bondi venue link").toBeTruthy();
  return id as string;
}

let errs: ReturnType<typeof watch>;
test.beforeEach(({ page }) => {
  errs = watch(page);
});
test.afterEach(() => errs.expectNone());

test.describe("bills, as the bookkeeper", () => {
  test("bills and bank questions open with real data, at phone width too", async ({
    browser,
  }) => {
    const { context, page, venue } = await as(browser, "bookkeeper");
    await page.setViewportSize({ width: 390, height: 800 });
    await open(page, venue, "bills");
    await expect(
      page.getByRole("heading", { name: "Bills", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overdue" })).toBeVisible();
    await expect(page.getByText(/still to pay/)).toBeVisible();
    await expectNoSideScroll(page);
    await open(page, venue, "bank");
    await expect(
      page.getByRole("heading", { name: "Bank questions", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/, oldest first\./)).toBeVisible();
    await expectNoSideScroll(page);
    await context.close();
  });
});

test.describe("bills, as the owner", () => {
  test("add a bill, see it, mark it, change it, take it off", async ({
    page,
  }) => {
    await signIn(page, "owner");
    const venue = await demoVenue(page);
    const name = unique("Test bill");
    const payee = unique("test payee").toLowerCase();
    await open(page, venue, "bills");
    await page.getByLabel("Bill name").fill(name);
    await page.getByLabel("Who is paid").fill(payee);
    const dollars = 100 + Math.floor(Math.random() * 800);
    const cents = String(Math.floor(Math.random() * 90) + 10);
    await page.getByLabel("Amount ($)").fill(`${dollars}.${cents}`);
    await page.getByLabel("Next due date").fill("2027-06-15");
    // A double click writes once.
    await page.getByRole("button", { name: "Add bill" }).dblclick();
    await expect(page.getByText(`Added ${name}.`)).toBeVisible();
    await expect(errorBanner(page)).toHaveCount(0);

    await open(page, venue, "bills?from=2027-06-01&to=2027-06-30&status=all");
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(1);
    await expect(
      page.getByText(`$${dollars}.${cents} due 2027-06-15`),
    ).toHaveCount(1);

    // The same kind and payee again is the API's own answer.
    await open(page, venue, "bills");
    await page.getByLabel("Bill name").fill(`${name} again`);
    await page.getByLabel("Who is paid").fill(payee);
    await page.getByLabel("Amount ($)").fill("10");
    await page.getByLabel("Next due date").fill("2027-06-16");
    await page.getByRole("button", { name: "Add bill" }).click();
    await expect(errorBanner(page)).toContainText(/already a bill like this/i);

    // The detail page.
    await open(page, venue, "bills?from=2027-06-01&to=2027-06-30&status=all");
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Mark paid" }).click();
    await expect(page.getByText("Paid. Marked as paid.")).toBeVisible();
    await page.getByRole("button", { name: "Open again" }).click();
    await expect(page.getByText("Due. This bill is coming up.")).toBeVisible();
    await expect(page.getByText(/No dockets are linked/)).toBeVisible();

    await page.getByLabel("Amount ($)").fill(`${dollars + 1}.${cents}`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText(`$${dollars + 1}.${cents} due 2027-06-15`),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/due=/);

    await page.getByRole("button", { name: "Take off the list" }).click();
    await page
      .getByRole("button", { name: "Yes, take it off the list" })
      .click();
    await page.waitForURL(/\/bills$/);
    await open(page, venue, "bills?from=2027-06-01&to=2027-06-30&status=all");
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  });

  test("the Bondi venue is empty and says so", async ({ page }) => {
    await signIn(page, "owner");
    const venue = await bondi(page);
    await open(page, venue, "bills");
    await expect(
      page.getByText("No bills fall due in this time."),
    ).toBeVisible();
    await expect(
      page.getByText("No supplier bills are overdue."),
    ).toBeVisible();
    await open(page, venue, "bank");
    await expect(
      page.getByText("No bank questions are waiting."),
    ).toBeVisible();
    await open(page, venue, "bank/files");
    await expect(page.getByText("No bank files need a check.")).toBeVisible();
  });
});

test.describe("bank, as the owner", () => {
  test("a waiting question shows its evidence and its answer form (not answered)", async ({
    page,
  }) => {
    await signIn(page, "owner");
    const venue = await demoVenue(page);
    await open(page, venue, "bank?status=open");
    const first = page.locator(`a[href*="/venues/${venue}/bank/"]`).filter({
      hasNotText: /Categories|Bank files|Start answering/,
    });
    await first.first().click();
    await expect(page.getByText(/^Date: /)).toBeVisible();
    await expect(page.getByText(/^Amount: /)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save answer" }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Set aside" })).toBeVisible();
    // An unknown question is not found.
    await page.goto(
      `/venues/${venue}/bank/00000000-0000-4000-8000-000000000000`,
    );
    await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
  });

  test("categories: add, relabel, switch off and on, a double click adds one", async ({
    page,
  }) => {
    await signIn(page, "owner");
    const venue = await demoVenue(page);
    const label = unique("Test cat");
    await open(page, venue, "bank/categories");
    await page.getByLabel("New category").fill(label);
    await page.getByRole("button", { name: "Add category" }).dblclick();
    await expect(page.getByText(`Added ${label}.`)).toBeVisible();
    await expect(page.getByText(label, { exact: true })).toHaveCount(1);
    // Adding the same name again is the API's 409.
    await page.getByLabel("New category").fill(label);
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(errorBanner(page)).toContainText(/already a category/i);

    const card = page
      .locator("div")
      .filter({ has: page.getByText(label, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Switch off" }) })
      .last();
    const renamed = `${label} b`;
    await card.getByLabel("Name shown").fill(renamed);
    await card.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText(renamed, { exact: true })).toBeVisible();
    const card2 = page
      .locator("div")
      .filter({ has: page.getByText(renamed, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Switch off" }) })
      .last();
    await card2.getByRole("button", { name: "Switch off" }).click();
    await expect(page.getByText(`${renamed} (switched off)`)).toBeVisible();
    await page.getByRole("button", { name: "Switch on" }).first().click();
    await expect(page.getByText(`${renamed} (switched off)`)).toHaveCount(0);
  });

  test("upload a bank file with one new payment, then answer that question", async ({
    page,
  }) => {
    await signIn(page, "owner");
    const venue = await demoVenue(page);
    const payee = `ZZTEST ${Date.now().toString(36).toUpperCase()}`;
    const csv = `Date,Description,Amount\n2026-10-20,${payee},-12.34\n`;
    await open(page, venue, "bank/files");
    await page.locator('input[type="file"]').setInputFiles({
      name: `test-${Date.now()}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: "Upload" }).dblclick();
    await expect(page.getByText(/rows read/).first()).toBeVisible();
    await expect(errorBanner(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Look at this file" }).click();
    await expect(page.getByText(payee)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Rows read/ }),
    ).toBeVisible();

    // Find my own question (the newest, so on a later page) and answer it.
    let found = false;
    for (const offset of [0, 25, 50, 75]) {
      await open(page, venue, `bank?status=open&offset=${offset}`);
      const link = page.getByRole("link", { name: new RegExp(payee) });
      if ((await link.count()) > 0) {
        await link.first().click();
        found = true;
        break;
      }
    }
    expect(found, "my question in the open list").toBe(true);
    await page.getByRole("button", { name: /^What was it/ }).click();
    await page.getByRole("option", { name: "Marketing" }).click();
    const here = page.url();
    await page.getByRole("button", { name: "Save answer" }).dblclick();
    await page.waitForURL((u) => u.toString() !== here, { timeout: 30_000 });
    await open(page, venue, "bank?status=answered");
    await expect(
      page.getByRole("link", { name: new RegExp(payee) }),
    ).toHaveCount(1);
  });

  test("bank files: the list opens and a done file shows its rows", async ({
    page,
  }) => {
    await signIn(page, "owner");
    const venue = await demoVenue(page);
    await open(page, venue, "bank/files?status=all");
    await expect(
      page.getByRole("heading", { name: "Bank files", level: 1 }),
    ).toBeVisible();
    await page.locator(`a[href*="/bank/files/"]`).first().click();
    await expect(page.getByText(/rows read, \d+ questions open/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Read again" }),
    ).toBeVisible();
  });
});

test.describe("who may not", () => {
  test("staff get not found on every page", async ({ browser }) => {
    const { context, page, venue } = await as(browser, "staff");
    for (const path of ["bills", "bank", "bank/categories", "bank/files"]) {
      await page.goto(`/venues/${venue}/${path}`);
      await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
    }
    const up = await page.request.post(`/venues/${venue}/bank/files/upload`, {
      multipart: {
        file: { name: "x.csv", mimeType: "text/csv", buffer: Buffer.from("a") },
      },
    });
    expect([403, 404]).toContain(up.status());
    await context.close();
  });
});
