import { type Browser, type Page, test } from "@playwright/test";
import { signIn, skipUnlessLive, unique } from "../support/live";
import {
  errorBanner,
  expect,
  expectNoSideScroll,
  open,
  watch,
} from "./owner-support";

skipUnlessLive();
test.describe.configure({ mode: "serial", timeout: 180_000 });
test.use({ actionTimeout: 30_000 });

const NOT_FOUND = /could not be found|not found/i;
const HR_WORDS = /employment contract|id document|visa|hr file/i;

let errs: ReturnType<typeof watch>;
test.beforeEach(({ page }) => {
  errs = watch(page);
});
test.afterEach(() => errs.expectNone());

async function as(
  browser: Browser,
  role: "owner" | "partner" | "manager" | "bookkeeper" | "staff",
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const venue = await signIn(page, role);
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

async function typeDate(page: Page, label: string | RegExp, typed: string) {
  const box = page.getByRole("combobox", { name: label });
  await box.fill(typed);
  await box.press("Tab");
}

test("owner adds a supplier once, edits it, and reads its prices and the comparison", async ({
  page,
}) => {
  const venue = await signIn(page, "owner");
  const name = unique("Test Supplier");
  const alias = unique("TS alias");
  await open(page, venue, "suppliers");
  await expect(
    page.getByRole("heading", { name: "Suppliers", level: 1 }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link")
      .filter({ hasText: /Smithfield|Harbour/ })
      .first(),
  ).toBeVisible();
  await page.getByRole("textbox", { name: /^Name/ }).fill(name);
  await page.getByLabel("Other spellings on dockets").fill(alias);
  const add = page.getByRole("button", { name: "Add supplier" });
  await add.dblclick();
  await page.waitForURL(/\/suppliers\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByText(alias).first()).toBeVisible();
  await expect(
    page.getByText("No purchases from this supplier yet."),
  ).toBeVisible();
  const firstUrl = page.url();

  await open(page, venue, "suppliers");
  await expect(page.getByRole("link", { name, exact: true })).toHaveCount(1);

  await page.goto(firstUrl);
  const renamed = `${name} Ltd`;
  await page.getByRole("textbox", { name: /^Name/ }).fill(renamed);
  await page.getByLabel("Payment terms (days after delivery)").fill("14");
  await page.getByRole("button", { name: "Save changes" }).dblclick();
  await expect(
    page.getByRole("heading", { name: renamed, level: 1 }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(firstUrl);
  await expect(page.getByText("Pay 14 days after delivery.")).toBeVisible();

  // a demo supplier shows real price history
  await open(page, venue, "suppliers");
  await page.getByRole("link", { name: /Bondi Poultry/ }).click();
  await expect(
    page.getByRole("heading", { name: "Prices paid" }),
  ).toBeVisible();
  await expect(page.getByText(/\d{4}-\d{2}-\d{2}: /).first()).toBeVisible();

  await open(page, venue, "suppliers/compare");
  await expect(
    page.getByRole("heading", { name: "Compare suppliers", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/Eight weeks to/)).toBeVisible();
  await typeDate(page, /Week starting/, "11/11/2026"); // a Wednesday
  await page.getByRole("button", { name: "Show this week" }).click();
  await expect(errorBanner(page).first()).toContainText(/Monday/);
  await open(page, venue, "suppliers/compare?week=2026-11-02");
  await expect(page.getByText(/Eight weeks to 2026-11-08/)).toBeVisible();
});

test("suppliers on phone width, and the empty Bondi venue", async ({
  page,
}) => {
  await signIn(page, "owner");
  const b = await bondi(page);
  await open(page, b, "suppliers");
  await expect(page.getByText("No suppliers yet.")).toBeVisible();
  await open(page, b, "suppliers/compare");
  await expect(
    page.getByText(/No items were bought from two or more suppliers/),
  ).toBeVisible();
  await open(page, b, "expiry");
  await expect(page.getByText("Nothing added yet.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, b, "suppliers");
  await expectNoSideScroll(page);
  await open(page, b, "expiry");
  await expectNoSideScroll(page);
});

test("manager and bookkeeper read suppliers only; staff find nothing", async ({
  browser,
}) => {
  for (const role of ["manager", "bookkeeper"] as const) {
    const { context, page, venue } = await as(browser, role);
    await open(page, venue, "suppliers");
    await expect(
      page.getByRole("heading", { name: "Suppliers", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add supplier" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: /Bondi Poultry/ }).click();
    await expect(
      page.getByRole("heading", { name: "Prices paid" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toHaveCount(0);
    await open(page, venue, "suppliers/compare");
    await expect(
      page.getByRole("heading", { name: "Compare suppliers", level: 1 }),
    ).toBeVisible();
    await context.close();
  }
  const bk = await as(browser, "bookkeeper");
  await open(bk.page, bk.venue, "expiry");
  await expect(bk.page.getByText(NOT_FOUND)).toBeVisible();
  await bk.context.close();
  const st = await as(browser, "staff");
  await open(st.page, st.venue, "suppliers");
  await expect(st.page.getByText(NOT_FOUND)).toBeVisible();
  await open(st.page, st.venue, "expiry");
  await expect(st.page.getByText(NOT_FOUND)).toBeVisible();
  await st.context.close();
});

test("owner adds an expiry item with a file, opens it, renews it and takes it back", async ({
  page,
  context,
}) => {
  const venue = await signIn(page, "owner");
  const title = unique("Test licence");
  await open(page, venue, "expiry");
  await expect(
    page.getByRole("heading", { name: "Licences and expiry", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(/Expired|Expiring soon|Fine for now/).first(),
  ).toBeVisible();
  // the owner is offered HR kinds as well
  await page.getByRole("combobox", { name: /^Kind/ }).click();
  await expect(
    page.getByRole("option", { name: "Employment contract", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("option", { name: "Equipment servicing", exact: true })
    .click();

  await page.getByRole("textbox", { name: /^Name/ }).fill(title);
  await typeDate(page, /Runs out on/, "03/15/2031");
  await page.locator('input[type="file"]').setInputFiles({
    name: "licence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      `%PDF-1.4\n% ${title}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`,
    ),
  });
  await page.getByRole("button", { name: "Add item" }).dblclick();
  await expect(page.getByText("Item added.")).toBeVisible();
  const link = page.getByRole("link", { name: title, exact: true });
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(
    page.getByRole("heading", { name: title, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/2031-03-15/).first()).toBeVisible();
  const first = page.url();

  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open the file" }).click();
  const opened = await popup;
  expect(opened.url()).toMatch(/^http/);
  await opened.close();

  await typeDate(page, /Runs out on/, "03/15/2032");
  await page.getByRole("button", { name: "Save changes" }).dblclick();
  await expect(page.getByText(/2032-03-15/).first()).toBeVisible();
  await expect(page).not.toHaveURL(first);

  // the replaced id opens the newest version under its own id
  const newest = page.url();
  await page.goto(first);
  await expect(page).toHaveURL(newest);
  await expect(page.getByText(/2032-03-15/).first()).toBeVisible();

  await open(page, venue, "expiry");
  await page.getByRole("link", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Take it back" }).click();
  await page.getByRole("button", { name: "Yes, take it back" }).click();
  await page.waitForURL(/\/expiry$/);
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0);
});

test("owner sees HR items; a manager sees none and no HR wording", async ({
  browser,
}) => {
  const o = await as(browser, "owner");
  await open(o.page, o.venue, "expiry");
  await expect(o.page.getByText(HR_WORDS).first()).toBeVisible();
  await o.context.close();

  const m = await as(browser, "manager");
  await open(m.page, m.venue, "expiry");
  await expect(
    m.page.getByRole("heading", { name: "Licences and expiry", level: 1 }),
  ).toBeVisible();
  await expect(
    m.page.getByText(/Public liability|Liquor licence/).first(),
  ).toBeVisible();
  await expect(m.page.getByText(HR_WORDS)).toHaveCount(0);
  await m.page.getByRole("combobox", { name: /^Kind/ }).click();
  await expect(
    m.page.getByRole("option", { name: "Equipment servicing", exact: true }),
  ).toBeVisible();
  await expect(m.page.getByRole("option", { name: HR_WORDS })).toHaveCount(0);
  await m.page.keyboard.press("Escape");
  await expect(m.page.locator("body")).not.toContainText(HR_WORDS);
  await m.context.close();
});
