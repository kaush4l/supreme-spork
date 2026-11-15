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

async function noSideScroll(page: Page) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(wide, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

/** Open the first dish on the recipes list. */
async function openFirstDish(page: Page, venue: string) {
  await openVenuePage(page, venue, "recipes");
  const first = page
    .getByRole("heading", { level: 2 })
    .first()
    .getByRole("link");
  await slow(first).toBeVisible();
  await first.click();
  await slow(
    page.getByRole("heading", { name: "Cost", level: 2 }),
  ).toBeVisible();
}

test("the list shows dishes with what each costs to make, on a phone too", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.setViewportSize({ width: 390, height: 800 });
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "recipes");
  await slow(
    mgr.page.getByRole("heading", { name: "Recipes", level: 1 }),
  ).toBeVisible();
  await slow(mgr.page.getByText(/Costs to make:/).first()).toBeVisible();
  await slow(mgr.page.getByText(/Suggested price for a/).first()).toBeVisible();
  for (const name of [
    /New dishes to confirm/,
    /How much of your sales has a recipe/,
    /Import recipes/,
  ])
    await expect(mgr.page.getByRole("link", { name })).toBeVisible();
  await noSideScroll(mgr.page);
  watch.expectNone();
  await mgr.context.close();
});

test("a dish shows its ingredients; a line and the portions change and are put back", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openFirstDish(mgr.page, mgr.venue);
  const page = mgr.page;
  await slow(
    page.getByText(/Price taken from|No docket has priced/).first(),
  ).toBeVisible();

  // One line: change the amount, then put the first value back.
  const amount = page.getByLabel(/^Amount in the dish \(/).first();
  await slow(amount).toBeVisible();
  const original = await amount.inputValue();
  await amount.fill(String(Number(original) + 1));
  await page
    .getByRole("button", { name: /^Save (?!portions)/ })
    .first()
    .click();
  await slow(page.getByText(/^Saved /)).toBeVisible();
  const changed = await page
    .getByLabel(/^Amount in the dish \(/)
    .first()
    .inputValue();
  expect(Number(changed)).toBe(Number(original) + 1);
  await page
    .getByLabel(/^Amount in the dish \(/)
    .first()
    .fill(original);
  await page
    .getByRole("button", { name: /^Save (?!portions)/ })
    .first()
    .click();
  await slow(page.getByText(/^Saved /)).toBeVisible();
  expect(
    Number(
      await page
        .getByLabel(/^Amount in the dish \(/)
        .first()
        .inputValue(),
    ),
  ).toBe(Number(original));

  // Portions: a double click writes once, then the old value goes back.
  const portions = page.getByLabel("How many portions this recipe makes");
  const was = await portions.inputValue();
  await portions.fill(String(Number(was) + 1));
  await page.getByRole("button", { name: "Save portions" }).dblclick();
  await slow(page.getByText("Portions saved.")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByLabel("How many portions this recipe makes"),
  ).toHaveValue(String(Number(was) + 1));
  await page.getByLabel("How many portions this recipe makes").fill(was);
  await page.getByRole("button", { name: "Save portions" }).click();
  await slow(page.getByText("Portions saved.")).toBeVisible();
  await mgr.context.close();
});

test("an ingredient is added with the picker and removed again", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openFirstDish(mgr.page, mgr.venue);
  const page = mgr.page;
  await page.getByRole("button", { name: /^Ingredient/ }).click();
  const option = page.getByRole("option").last();
  const label = (await option.textContent()) ?? "";
  const name = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  expect(name).not.toBe("");
  await option.click();
  await page.getByLabel("Amount in the dish", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await slow(page.getByText("Ingredient added.")).toBeVisible();
  const remove = page.getByRole("button", { name: `Remove ${name}` });
  await slow(remove).toBeVisible();
  await remove.click();
  await slow(page.getByText(`Removed ${name}.`)).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Remove ${name}` }),
  ).toHaveCount(0);
  await mgr.context.close();
});

test("a bookkeeper reads recipes without any buttons; staff are told not found", async ({
  browser,
}) => {
  const book = await as(browser, "bookkeeper");
  await openFirstDish(book.page, book.venue);
  await expect(
    book.page.getByRole("button", { name: /^Save|^Remove|^Add/ }),
  ).toHaveCount(0);
  await openVenuePage(book.page, book.venue, "recipes/new-dishes");
  await slow(
    book.page.getByRole("heading", { name: "New dishes", level: 1 }),
  ).toBeVisible();
  await expect(
    book.page.getByRole("button", { name: /real dish|another spelling/ }),
  ).toHaveCount(0);
  await openVenuePage(book.page, book.venue, "recipes/import");
  await slow(
    book.page.getByText(/Only an owner, partner or manager/),
  ).toBeVisible();
  await book.context.close();

  const staff = await as(browser, "staff");
  for (const path of [
    "recipes",
    "recipes/new-dishes",
    "recipes/coverage",
    "recipes/import",
  ]) {
    await openVenuePage(staff.page, staff.venue, path);
    await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  }
  await staff.context.close();
});

test("coverage says how much of the sales has a recipe", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "recipes/coverage");
  await slow(
    mgr.page.getByRole("heading", { name: "Recipe coverage", level: 1 }),
  ).toBeVisible();
  await slow(
    mgr.page.getByText(/of what you sold has a recipe|no sales in this period/),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("heading", { name: /sold without a recipe/ }),
  ).toBeVisible();
  await mgr.context.close();
});

test("the empty Bondi venue shows plain empty states", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto("/");
  const href = await page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: /Bondi/ })
    .first()
    .getAttribute("href");
  const bondi = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1] ?? "";
  expect(bondi).toBeTruthy();
  await openVenuePage(page, bondi, "recipes");
  await slow(page.getByText(/No dishes have a recipe yet/)).toBeVisible();
  await openVenuePage(page, bondi, "recipes/new-dishes");
  await slow(page.getByText(/No new dishes to look at/)).toBeVisible();
  await openVenuePage(page, bondi, "recipes/coverage");
  await slow(page.getByText(/no sales in this period/)).toBeVisible();
  await slow(page.getByText(/Every dish that sold has a recipe/)).toBeVisible();
});

test("an import skips what no docket has bought; confirm and merge go only as far as the question", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const page = mgr.page;
  const own = unique("Spec dish");
  const ghost = unique("Spec ghost");
  await openVenuePage(page, mgr.venue, "recipes/import");
  await slow(
    page.getByRole("heading", { name: "Import recipes", level: 1 }),
  ).toBeVisible();

  // A file without the right columns is refused in plain words.
  await page.locator('input[type="file"]').setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n1,2\n"),
  });
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await slow(
    page.getByText(/needs the columns dish, ingredient, qty and unit/),
  ).toBeVisible();

  // One dish of its own with an ingredient nobody has bought: the line is skipped and named.
  await page.locator('input[type="file"]').setInputFiles({
    name: "recipes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`dish,ingredient,qty,unit\n${own},${ghost},1,g\n`),
  });
  await page.getByRole("button", { name: "Import", exact: true }).dblclick();
  await slow(page.getByText("The file was read")).toBeVisible();
  await slow(page.getByText(ghost, { exact: true })).toBeVisible();
  await expect(page.getByText(/1 skipped/)).toBeVisible();

  // The demo's own new dishes are never confirmed or merged here: the buttons are there, and the merge
  // question is asked (with the spec's own dish as the target), then cancelled.
  await openVenuePage(page, mgr.venue, "recipes/new-dishes");
  await slow(
    page.getByRole("button", { name: /^This is a real dish: / }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^This is another spelling of\.\.\. / })
    .first()
    .click();
  await page
    .getByRole("button", { name: / is another spelling of/ })
    .first()
    .click();
  await page.getByRole("combobox", { name: "Search options" }).fill(own);
  await page.getByRole("option", { name: own }).click();
  await slow(
    page.getByText(/All its sales and spellings move there/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Yes, move the sales of / }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Cancel/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /^Yes, move the sales of / }),
  ).toHaveCount(0);
  await mgr.context.close();
});
