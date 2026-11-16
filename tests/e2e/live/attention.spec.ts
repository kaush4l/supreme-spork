import { expect, type Page, test } from "@playwright/test";
import { signIn, skipUnlessLive } from "../support/live";
import { expectNoSideScroll, watch } from "./owner-support";

skipUnlessLive();
test.describe.configure({ timeout: 120_000, mode: "serial" });

let errs: ReturnType<typeof watch>;
test.beforeEach(({ page }) => {
  errs = watch(page);
});
test.afterEach(() => errs.expectNone());

const heading = (page: Page, name: string | RegExp, level = 2) =>
  page.getByRole("heading", { name, level });

async function openAttention(page: Page, venue: string) {
  await page.goto(`/venues/${venue}/attention`);
  await expect(heading(page, "Needs attention", 1)).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("load");
}

/** The empty second venue of the owner, found by its name on the home page. */
async function bondiVenue(page: Page): Promise<string> {
  await page.goto("/");
  const href = await page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: /Bondi/ })
    .first()
    .getAttribute("href");
  const id = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1];
  expect(id, "the Bondi venue link on the home page").toBeTruthy();
  return id as string;
}

const COUNT = /^(1 thing needs you\.|\d+ things need you\.)$/;
const CARDS = (page: Page) => page.getByRole("heading", { level: 3 });

test.describe("needs attention", () => {
  test("the owner sees the count, sections and a card with a working Open link", async ({
    page,
  }) => {
    const venue = await signIn(page, "owner");
    await openAttention(page, venue);
    await expect(page.getByText(COUNT)).toBeVisible();
    // At least one section, each one of the three named groups.
    const sections = page.getByRole("heading", {
      name: /^(Do now|Soon|Keep an eye on)$/,
      level: 2,
    });
    expect(await sections.count()).toBeGreaterThan(0);
    expect(await CARDS(page).count()).toBeGreaterThan(0);
    const open = page.getByRole("link", { name: "Open" }).first();
    await expect(open).toBeVisible();
    await expect(page.getByText(/^For: /).first()).toBeVisible();
    // The first Open link leads to a real page of ours.
    const href = await open.getAttribute("href");
    expect(href).toMatch(new RegExp(`^/venues/${venue}/`));
    await page.setViewportSize({ width: 390, height: 800 });
    await expectNoSideScroll(page);
    await open.click();
    await page.waitForURL((u) => u.pathname !== `/venues/${venue}/attention`);
    await expect(page.getByText(/could not be found/i)).toHaveCount(0);
  });

  test("the owner's navigation lists Needs attention first and a login lands there", async ({
    page,
  }) => {
    const venue = await signIn(page, "owner");
    await page.goto(`/venues/${venue}`);
    await page.waitForURL(`**/venues/${venue}/attention`);
    await expect(heading(page, "Needs attention", 1)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Needs attention" }).first(),
    ).toBeVisible();
  });

  test("the manager lands on it and sees cards for what they may act on", async ({
    page,
  }) => {
    const venue = await signIn(page, "manager");
    await page.goto(`/venues/${venue}`);
    await page.waitForURL(`**/venues/${venue}/attention`);
    await expect(heading(page, "Needs attention", 1)).toBeVisible();
    await expect(page.getByText(COUNT)).toBeVisible();
    expect(await CARDS(page).count()).toBeGreaterThan(0);
    await expect(
      page.getByRole("link", { name: "Open" }).first(),
    ).toBeVisible();
    // Findings are for the books roles; every card says who it is for, and it includes the manager.
    for (const who of await page.getByText(/^For: /).allTextContents())
      expect(who).toContain("manager");
  });

  test("the bookkeeper sees money and findings only, and keeps This week as the landing page", async ({
    page,
  }) => {
    const venue = await signIn(page, "bookkeeper");
    await openAttention(page, venue);
    await expect(page.getByText(COUNT)).toBeVisible();
    expect(await CARDS(page).count()).toBeGreaterThan(0);
    for (const who of await page.getByText(/^For: /).allTextContents())
      expect(who).toContain("bookkeeper");
    // No leave, swap, offer, draft, change or licence cards.
    await expect(
      page.getByRole("heading", {
        name: /Leave request|Shift swap request|Shift offer|Draft roster|Change waiting|expir|licence/i,
        level: 3,
      }),
    ).toHaveCount(0);
    await page.goto(`/venues/${venue}`);
    await page.waitForURL(`**/venues/${venue}/week`);
  });

  test("staff get not found", async ({ page }) => {
    const venue = await signIn(page, "staff");
    await page.goto(`/venues/${venue}/attention`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await expect(heading(page, "Needs attention", 1)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Needs attention" }),
    ).toHaveCount(0);
  });

  test("the owner's empty second venue shows the empty state or only its few real items", async ({
    page,
  }) => {
    await signIn(page, "owner");
    const bondi = await bondiVenue(page);
    await openAttention(page, bondi);
    const empty = page.getByText("Nothing needs you right now.");
    if ((await empty.count()) > 0) {
      await expect(empty).toBeVisible();
      await expect(CARDS(page)).toHaveCount(0);
    } else {
      // The backend may still list today's "No sales report" for an empty venue.
      await expect(page.getByText(COUNT)).toBeVisible();
      expect(await CARDS(page).count()).toBeLessThanOrEqual(3);
    }
  });
});
