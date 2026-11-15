import { type Page, test } from "@playwright/test";
import { signIn, skipUnlessLive } from "../support/live";
import {
  demoVenue,
  errorBanner,
  expect,
  expectNoSideScroll,
  open,
  watch,
} from "./owner-support";

skipUnlessLive();

let errs: ReturnType<typeof watch>;
test.beforeEach(({ page }) => {
  errs = watch(page);
});
test.afterEach(() => errs.expectNone());
test.describe.configure({ timeout: 120_000 });

const heading = (page: Page, name: string | RegExp, level = 2) =>
  page.getByRole("heading", { name, level });
const refresh = (page: Page) =>
  page.getByRole("button", { name: "Refresh this day" });

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

test.describe("this week, findings and messages, as the owner", () => {
  test.describe.configure({ mode: "serial" });
  let venue: string;
  test.beforeEach(async ({ page }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
  });

  test("the week page shows the day, earlier days and findings", async ({
    page,
  }) => {
    await open(page, venue, "week");
    await expect(heading(page, "This week", 1)).toBeVisible();
    await expect(heading(page, "The day in figures")).toBeVisible();
    await expect(page.getByText(/^Day: \d{4}-\d{2}-\d{2}$/)).toBeVisible();
    await expect(page.getByText(/Net sales:/)).toBeVisible();
    await expect(heading(page, "Needs your attention", 3)).toBeVisible();
    await expect(heading(page, "Earlier days", 3)).toBeVisible();
    await expect(heading(page, "Findings")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Previous week" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Next week" })).toBeVisible();
    await expect(refresh(page)).toBeVisible();
  });

  test("a chosen day shows that day", async ({ page }) => {
    await open(page, venue, "week?day=2026-11-07");
    await expect(page.getByText("Day: 2026-11-07")).toBeVisible();
  });

  test("a bad day is ignored", async ({ page }) => {
    await open(page, venue, "week?day=not-a-day");
    await expect(page.getByText(/^Day: \d{4}-\d{2}-\d{2}$/)).toBeVisible();
  });

  test("a future day says so in plain words", async ({ page }) => {
    await open(page, venue, "week?day=2099-01-01");
    await expect(errorBanner(page).first()).toContainText(
      "That day has not started yet.",
    );
  });

  test("the week links step to the neighbouring weeks that have findings", async ({
    page,
  }) => {
    await open(page, venue, "week?week=2026-11-09");
    await page.getByRole("link", { name: "Previous week" }).click();
    await expect(page).toHaveURL(/week=2026-11-02/);
    await page.getByRole("link", { name: "Next week" }).click();
    await expect(page).toHaveURL(/week=2026-11-09/);
    await page.getByRole("link", { name: "Next week" }).click();
    await expect(page).toHaveURL(/week=2026-11-16/);
    await page.getByRole("link", { name: "Next week" }).click();
    await expect(page).not.toHaveURL(/week=2026-11-23/);
    await expect(page.getByText(/^No findings for the week/)).toHaveCount(0);
  });

  test("with no week in the address it opens on a week that has findings", async ({
    page,
  }) => {
    await open(page, venue, "week");
    await expect(
      page.getByText(/^Week starting \d{4}-\d{2}-\d{2} \(/),
    ).toBeVisible();
    await expect(page.getByText(/^No findings for the week/)).toHaveCount(0);
  });

  test("refresh saves the day once even on a double click", async ({
    page,
  }) => {
    await open(page, venue, "week?day=2026-11-14");
    await refresh(page).dblclick();
    await expect(page.getByText("This day is up to date.")).toBeVisible();
    await expect(errorBanner(page)).toHaveCount(0);
  });

  test("a finding opens with its working and its rows, paged", async ({
    page,
  }) => {
    await open(page, venue, "week?week=2026-11-09");
    await page
      .getByRole("link", { name: /^(Stock gap|Margin by channel)/ })
      .first()
      .click();
    await expect(heading(page, "How it was worked out")).toBeVisible();
    await expect(heading(page, "The rows behind it")).toBeVisible();
    await expect(page.getByText(/^Rows 1 to \d+ of \d+\.$/)).toBeVisible();
    const more = page.getByRole("link", { name: "More rows" });
    if (await more.count()) {
      await more.click();
      await expect(page).toHaveURL(/offset=\d+/);
      await expect(page.getByText(/^Rows \d+ to \d+ of \d+\.$/)).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Earlier rows" }),
      ).toBeVisible();
    }
  });

  test("a Monday message shows numbered sections that link to findings", async ({
    page,
  }) => {
    await open(page, venue, "messages");
    await expect(heading(page, "Monday messages", 1)).toBeVisible();
    await page
      .getByRole("link", { name: /Minder weekly/ })
      .first()
      .click();
    await expect(page.getByText(/^1\. /).first()).toBeVisible();
    await page.getByRole("link", { name: "See the evidence" }).first().click();
    await expect(heading(page, "The rows behind it")).toBeVisible();
  });

  test("works at phone width with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["week", "messages"]) {
      await open(page, venue, path);
      await expect(heading(page, /This week|Monday messages/, 1)).toBeVisible();
      await expectNoSideScroll(page);
    }
  });

  test("an unknown finding or message shows not-found", async ({ page }) => {
    for (const path of [
      "findings/00000000-0000-4000-8000-000000000000",
      "messages/00000000-0000-4000-8000-000000000000",
      "findings/not-a-uuid",
    ]) {
      await open(page, venue, path);
      await expect(page.getByText(/could not be found/i)).toBeVisible();
    }
  });

  test("the empty Bondi venue says so in plain words", async ({ page }) => {
    const bondi = await bondiVenue(page);
    await open(page, bondi, "week");
    await expect(page.getByText(/^No findings yet\./)).toBeVisible();
    await expect(page.getByText(/^Day: \d{4}-\d{2}-\d{2}$/)).toBeVisible();
    await open(page, bondi, "messages");
    await expect(
      page.getByText("No messages have been sent to this venue yet."),
    ).toBeVisible();
  });
});

test.describe("this week, as other roles", () => {
  test("a partner sees the figures and the refresh button", async ({
    page,
  }) => {
    const venue = await signIn(page, "partner");
    await open(page, venue, "week");
    await expect(heading(page, "The day in figures")).toBeVisible();
    await expect(refresh(page)).toBeVisible();
  });

  test("a bookkeeper sees the figures but cannot refresh", async ({ page }) => {
    const venue = await signIn(page, "bookkeeper");
    await open(page, venue, "week");
    await expect(heading(page, "The day in figures")).toBeVisible();
    await expect(refresh(page)).toHaveCount(0);
  });

  test("a manager sees the findings and messages but no day figures", async ({
    page,
  }) => {
    const venue = await signIn(page, "manager");
    await open(page, venue, "week");
    await expect(heading(page, "Findings")).toBeVisible();
    await expect(heading(page, "The day in figures")).toHaveCount(0);
    await expect(refresh(page)).toHaveCount(0);
    await open(page, venue, "messages");
    await expect(heading(page, "Monday messages", 1)).toBeVisible();
  });

  test("a staff member gets not found", async ({ page }) => {
    const venue = await signIn(page, "staff");
    for (const path of ["week", "messages"]) {
      await open(page, venue, path);
      await expect(page.getByText(/could not be found/i)).toBeVisible();
    }
  });
});
