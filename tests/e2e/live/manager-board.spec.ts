import { expect, type Page, test } from "@playwright/test";
import {
  signIn,
  skipUnlessLive,
  unique,
  watchForBrowserErrors,
} from "../support/live";
import { noSideScroll, pickerDate } from "./manager-helpers";

skipUnlessLive();

const DEMO_DAY = "2026-11-09";
const EMPTY_DAY = "2027-03-01";
const STATUS = /^(Done|To do|Overdue|Not done)$/;

async function openBoard(page: Page, venue: string, day?: string) {
  await page.goto(`/venues/${venue}/board${day ? `?day=${day}` : ""}`);
  await expect(
    page.getByRole("heading", { name: "Today board", level: 1 }),
  ).toBeVisible();
  // Let the page hydrate so a click on a link is not lost to the first client render.
  await page.waitForLoadState("load");
}

test.describe("manager today board", () => {
  test("the board draws for the demo day with counts, statuses and photo counts", async ({
    page,
  }) => {
    const errors = watchForBrowserErrors(page);
    const v = await signIn(page, "manager");
    await openBoard(page, v, DEMO_DAY);
    await expect(page.getByLabel("Day", { exact: true })).toHaveValue(
      pickerDate(DEMO_DAY),
    );
    await expect(
      page.getByText(
        /Mon, 9 Nov · \d+ lists?: \d+ done, \d+ to do, \d+ overdue, \d+ not done/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/\d+ readings? outside range · \d+ photos? · as of /),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Who is on" }),
    ).toBeVisible();
    // Every list shows a friendly status word, a due time and progress, never the raw status.
    const lists = page
      .getByRole("link", { name: /^(Closing|Opening|.+)$/ })
      .filter({
        has: page.locator("xpath=self::a[contains(@href,'/board/')]"),
      });
    expect(await lists.count()).toBeGreaterThan(0);
    await expect(page.getByText(STATUS).first()).toBeVisible();
    await expect(
      page.getByText(/Due \d{1,2}:\d{2} [ap]m · \d+ of \d+ done/).first(),
    ).toBeVisible();
    errors.expectNone();
  });

  test("the day picker moves the board to another day and back", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    await openBoard(page, v, EMPTY_DAY);
    const day = page.getByLabel("Day", { exact: true });
    await expect(day).toHaveValue(pickerDate(EMPTY_DAY));
    await day.fill(pickerDate(DEMO_DAY));
    await day.press("Enter");
    await expect(page).toHaveURL(new RegExp(`board\\?day=${DEMO_DAY}`));
    await expect(page.getByText(/Mon, 9 Nov · /)).toBeVisible();
    await expect(
      page.getByText(
        "Nobody is rostered and no lists were issued for this day.",
      ),
    ).toHaveCount(0);
  });

  test("a day with no lists shows the empty state", async ({ page }) => {
    const v = await signIn(page, "manager");
    await openBoard(page, v, EMPTY_DAY);
    await expect(
      page.getByText(
        /Mon, 1 Mar · 0 lists: 0 done, 0 to do, 0 overdue, 0 not done/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Nobody is rostered and no lists were issued for this day.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Needs attention" }),
    ).toHaveCount(0);
  });

  test("a malformed day is ignored and the board still draws", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    await openBoard(page, v, "not-a-day");
    await expect(
      page.getByRole("heading", { name: "Who is on" }),
    ).toBeVisible();
  });

  test("open a list, see its items, answer one as the manager, and the board follows", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    await openBoard(page, v, DEMO_DAY);
    const link = page.locator(`a[href^="/venues/${v}/board/"]`).first();
    const name = (await link.innerText()).split(",")[0];
    await link.click();
    await expect(page).toHaveURL(
      new RegExp(`/venues/${v}/board/[0-9a-f-]{36}$`),
      { timeout: 30_000 },
    );
    await expect(
      page.getByRole("link", { name: "Back to the Today board" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    await expect(page.getByText(STATUS).first()).toBeVisible();
    await expect(
      page.getByText(/Due .*\d{1,2}:\d{2} [ap]m/).first(),
    ).toBeVisible();
    await expect(page.getByText(/\d+ of \d+ done/).first()).toBeVisible();

    // Answer an item as the manager: a note if the list has one (new text each run), else tick one.
    const noteBox = page.getByLabel("Note").first();
    if ((await noteBox.count()) > 0) {
      const text = unique("Checked by manager");
      await noteBox.fill(text);
      // The page already shows an "Answered" label from earlier runs, so wait for the save itself before reloading.
      const saved = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes("/board/"),
      );
      await page.getByRole("button", { name: "Save note" }).first().click();
      await saved;
      await expect(page.getByText(/^Answered /).first()).toBeVisible();
      await page.reload();
      await expect(page.getByLabel("Note").first()).toHaveValue(text);
    } else {
      const sw = page.getByRole("switch", { name: "Not done yet" }).first();
      test.skip(
        (await sw.count()) === 0,
        "this list has no note or tick item to answer",
      );
      await sw.click();
      await expect(page.getByText(/^Answered /).first()).toBeVisible();
    }
    await expect(page.getByText(/(Not saved|did not work)/i)).toHaveCount(0);
    await page.getByRole("link", { name: "Back to the Today board" }).click();
    await expect(
      page.getByRole("heading", { name: "Who is on" }),
    ).toBeVisible();
  });

  test("a list detail page raises no CSP violation", async ({ page }) => {
    const errors = watchForBrowserErrors(page);
    const v = await signIn(page, "manager");
    await openBoard(page, v, DEMO_DAY);
    await page.locator(`a[href^="/venues/${v}/board/"]`).first().click();
    await expect(
      page.getByRole("link", { name: "Back to the Today board" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("load");
    errors.expectNone();
  });

  test("an unknown list id and an unknown venue id show not found", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const notFound = page.getByText(/could not be found/i);
    // (A page with a loading state streams, so its status stays 200: check the words.)
    await page.goto(`/venues/${v}/board/00000000-0000-4000-8000-000000000000`);
    await expect(notFound).toBeVisible();
    await page.goto(`/venues/${v}/board/nope`);
    await expect(notFound).toBeVisible();
    await page.goto("/venues/00000000-0000-4000-8000-000000000000/board");
    await expect(notFound).toBeVisible();
  });

  test("staff cannot open the board", async ({ page }) => {
    const v = await signIn(page, "staff");
    await page.goto(`/venues/${v}/board`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });

  test("the board and a list are usable at phone width with no sideways scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const v = await signIn(page, "manager");
    await openBoard(page, v, DEMO_DAY);
    await noSideScroll(page);
    await page.locator(`a[href^="/venues/${v}/board/"]`).first().click();
    await expect(
      page.getByRole("link", { name: "Back to the Today board" }),
    ).toBeVisible({ timeout: 30_000 });
    await noSideScroll(page);
  });
});
