import { expect, type Page, test } from "@playwright/test";
import {
  signIn,
  skipUnlessLive,
  unique,
  watchForBrowserErrors,
} from "../support/live";
import { makeOwnList, PNG, pick } from "./manager-checklist-helpers";
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
    const back = page.getByRole("link", { name: "Back to the Today board" });
    const first = page.locator(`a[href^="/venues/${v}/board/"]`).first();
    // A first click right after the board draws can be lost on the dev server (the page navigates to its own address
    // again instead of opening the list), so click again until the list opens.
    await expect(async () => {
      if (!(await back.isVisible())) await first.click({ timeout: 5_000 });
      await expect(back).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 60_000 });
    await noSideScroll(page);
  });
});

// A manager works on a list of our own: a template copy, a rule for one person, one issued list.
test.describe("manager edits a list of its own", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);
  test.use({ actionTimeout: 30_000 });
  let own: { name: string; listUrl: string } | null = null;
  let savedName = "";

  const cardOf = (page: Page, label: string) =>
    page
      .getByText(label, { exact: true })
      .locator(
        "xpath=ancestor::*[.//button[normalize-space()='Not applicable' or normalize-space()='Undo, this applies']][1]",
      );
  const changeButton = (page: Page, label: string) =>
    page.getByRole("button", { name: `Change \u201c${label}\u201d` });
  const takeOff = (page: Page, label: string) =>
    changeButton(page, label)
      .locator(
        "xpath=ancestor::*[.//button[normalize-space()='Take off this list']][1]",
      )
      .getByRole("button", { name: "Take off this list" });
  const addForm = (page: Page) => ({
    label: page.getByLabel("What to check").last(),
    add: page.getByRole("button", { name: "Add item" }),
  });

  test("a template copy, a rule and an issued list are made for these tests", async ({
    page,
  }) => {
    await signIn(page, "manager").then(async (v) => {
      own = await makeOwnList(page, v);
    });
    expect(own?.listUrl).toMatch(/\/board\/[0-9a-f-]{36}$/);
  });

  test("add an item (a double click adds one), reword it, change its kind, range and place", async ({
    page,
  }) => {
    test.skip(!own, "no list of our own");
    const errors = watchForBrowserErrors(page);
    await signIn(page, "manager");
    await page.goto((own as { listUrl: string }).listUrl);
    await expect(
      page.getByRole("heading", { name: "Add an item to this list" }),
    ).toBeVisible();
    await page.waitForLoadState("load");
    const first = unique("Wipe bench");
    await addForm(page).label.fill(first);
    await addForm(page).add.dblclick();
    await expect(page.getByText(first, { exact: true })).toHaveCount(1);
    await expect(changeButton(page, first)).toBeVisible();

    const second = `${first} again`;
    await changeButton(page, first).click();
    await page.getByLabel("What to check").first().fill(second);
    await pick(page, /^Answer with/, "Number");
    await page.getByLabel("Lowest allowed").first().fill("2");
    await page.getByLabel("Highest allowed").first().fill("8");
    await page.getByLabel(/^Place in the list/).fill("0");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(second, { exact: true })).toBeVisible();
    await expect(page.getByText(first, { exact: true })).toHaveCount(0);
    await expect(cardOf(page, second)).toContainText("Expected: 2 to 8");

    // a range that is the wrong way round is refused with the API's sentence
    await changeButton(page, second).click();
    await page.getByLabel("Lowest allowed").first().fill("9");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("The minimum must not be above the maximum."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    errors.expectNone();
  });

  test("mark an item not applicable with a reason and undo it, take off an added item, keep a template item", async ({
    page,
  }) => {
    test.skip(!own, "no list of our own");
    await signIn(page, "manager");
    await page.goto((own as { listUrl: string }).listUrl);
    await page.waitForLoadState("load");
    const label = unique("Spare item");
    await addForm(page).label.fill(label);
    await addForm(page).add.click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();

    await cardOf(page, label)
      .getByRole("button", { name: "Not applicable" })
      .click();
    // no reason: the button stays off
    await expect(
      cardOf(page, label).getByRole("button", { name: "Mark not applicable" }),
    ).toBeDisabled();
    await page.getByLabel("Why does this not apply?").fill("Not used today");
    await cardOf(page, label)
      .getByRole("button", { name: "Mark not applicable" })
      .click();
    await expect(
      page.getByText("Not applicable: Not used today"),
    ).toBeVisible();
    await cardOf(page, label)
      .getByRole("button", { name: "Undo, this applies" })
      .click();
    await expect(page.getByText("Not applicable: Not used today")).toHaveCount(
      0,
    );

    // the first item comes from the template and is never taken off
    await page
      .getByRole("button", { name: "Take off this list" })
      .first()
      .click();
    await expect(
      page.getByText(
        "An item from the template is not removed from a list. Mark it not applicable instead.",
      ),
    ).toBeVisible();

    await takeOff(page, label).click();
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  });

  test("attach a photo to a photo item for someone", async ({ page }) => {
    test.skip(!own, "no list of our own");
    // (The dev server does not allow the storage address in img-src, so the picture itself may be blocked there.)
    await signIn(page, "manager");
    await page.goto((own as { listUrl: string }).listUrl);
    await page.waitForLoadState("load");
    const label = unique("Photo of pass");
    await addForm(page).label.fill(label);
    await pick(page, /^Answer with/, "Photo");
    await addForm(page).add.click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    const card = cardOf(page, label);
    await card
      .locator('input[type="file"]')
      .setInputFiles({ name: "pass.png", mimeType: "image/png", buffer: PNG });
    await expect(
      cardOf(page, label).getByText("Take or choose a new photo"),
    ).toBeVisible({ timeout: 30_000 });
    await expect(cardOf(page, label).getByText(/^Answered /)).toBeVisible();
  });

  test("save the list as a new template, then finish it (what is still to do is shown first)", async ({
    page,
  }) => {
    test.skip(!own, "no list of our own");
    await signIn(page, "manager");
    await page.goto((own as { listUrl: string }).listUrl);
    await page.waitForLoadState("load");
    const required = unique("Must do");
    await addForm(page).label.fill(required);
    await page.getByLabel("Must be done to finish the list").last().check();
    await addForm(page).add.click();
    await expect(page.getByText(required, { exact: true })).toBeVisible();

    await page
      .getByRole("button", { name: "Finish list", exact: true })
      .click();
    await expect(page.getByText("Not finished yet")).toBeVisible();
    const stillToDo = page.getByText(/^Still to do: .*Must do/);
    await expect(stillToDo).toBeVisible();
    const left = (await stillToDo.innerText())
      .replace(/^Still to do: /, "")
      .replace(/\.$/, "")
      .split(", ");

    // save as a new template: it goes to the new template, which has the added item
    savedName = unique("Saved list");
    await page.getByLabel("Name for the new checklist").fill(savedName);
    await page.getByRole("button", { name: "Save as a new template" }).click();
    await expect(
      page.getByRole("heading", { name: savedName, level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(required, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retire" }).click();
    await page.getByRole("button", { name: "Yes, retire it" }).click();
    await expect(
      page.getByRole("heading", { name: "Checklists", level: 1 }),
    ).toBeVisible();

    // finish: mark every required item not applicable, then finish
    await page.goto((own as { listUrl: string }).listUrl);
    await page.waitForLoadState("load");
    for (const [n, label] of left.entries()) {
      await page.reload();
      await page.waitForLoadState("load");
      await cardOf(page, label)
        .getByRole("button", { name: "Not applicable" })
        .click();
      await page
        .getByRole("textbox", { name: /Why does this not apply/ })
        .fill("Not needed");
      await page.getByRole("button", { name: "Mark not applicable" }).click();
      await expect(page.getByText("Not applicable: Not needed")).toHaveCount(
        n + 1,
      );
    }
    await page.reload();
    await page.waitForLoadState("load");
    await page
      .getByRole("button", { name: "Finish list", exact: true })
      .dblclick();
    await expect(page.getByText(/^Finished/)).toBeVisible();
    await expect(page.getByText("Done", { exact: true }).first()).toBeVisible();
  });

  test("a manager list page is usable at phone width with the new forms", async ({
    page,
  }) => {
    test.skip(!own, "no list of our own");
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "manager");
    await page.goto((own as { listUrl: string }).listUrl);
    await expect(
      page.getByRole("heading", { name: "Save as a new template" }),
    ).toBeVisible();
    await noSideScroll(page);
  });
});
