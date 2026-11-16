import { expect, type Page, test } from "@playwright/test";
import { openVenuePage, signIn, skipUnlessLive, unique } from "../support/live";
import {
  api,
  must,
  PRIYA,
  staffIds,
  venuePath,
  watchApp,
} from "../support/staff-api";

skipUnlessLive();
test.use({ actionTimeout: 20_000 });
// the staff login is shared and the draft is one week's state, so the tests run one after the other
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
const soon = expect.configure({ timeout: 30_000 });

const NOT_FOUND = /could not be found|not found/i;
const MINE = "37 min break";
const OPEN = "41 min break";

/** The smallest element holding the text (a shift card is found by its unique break). */
const card = (page: Page, text: string) =>
  page
    .locator("div, section, article, li")
    .filter({ hasText: text })
    .filter({ has: page.getByRole("button") })
    .last();

/** A Monday far in the future that no earlier run used (2040 to about 2090). */
function farMonday(): string {
  const d = new Date(
    Date.UTC(2040, 0, 2) + Math.floor(Math.random() * 2500) * 7 * 86_400_000,
  );
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function plusDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

let week = "";
let draftId = "";
const shiftIds: string[] = [];

test.beforeAll(async () => {
  week = farMonday();
  const v = await venuePath();
  const ids = await staffIds();
  const mine = await must(
    api("manager", "POST", `${v}/roster/shifts`, {
      position: "Bartender",
      staff_id: ids[PRIYA],
      start: `${plusDays(week, 1)}T10:00:00`,
      end: `${plusDays(week, 1)}T16:00:00`,
      break_minutes: 37,
    }),
    "my shift",
  );
  const open = await must(
    api("manager", "POST", `${v}/roster/shifts`, {
      position: "Bartender",
      staff_id: null,
      start: `${plusDays(week, 2)}T10:00:00`,
      end: `${plusDays(week, 2)}T14:00:00`,
      break_minutes: 41,
    }),
    "open shift",
  );
  shiftIds.push(mine.external_id, open.external_id);
  const sent = await must(
    api("manager", "POST", `${v}/roster/weeks/${week}/send`, {
      mode: "draft",
    }),
    "send draft",
  );
  draftId = sent.id as string;
});

test.afterAll(async () => {
  const v = await venuePath();
  if (draftId)
    await api("manager", "POST", `${v}/roster/drafts/${draftId}/cancel`);
  for (const id of shiftIds)
    await api("manager", "POST", `${v}/roster/shifts/${id}/cancel`);
});

test("a person with no staff profile gets not found", async ({ page }) => {
  const id = await signIn(page, "owner");
  await openVenuePage(page, id, "shifts/drafts");
  await soon(page.getByText(NOT_FOUND).first()).toBeVisible();
});

test("a draft is marked as not final and shows my shift, the open shift and no money", async ({
  page,
}) => {
  const errors = watchApp(page);
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "shifts/drafts");
  await soon(
    page.getByRole("heading", { name: "Draft rosters", level: 1 }),
  ).toBeVisible();
  await soon(page.getByText(/^Draft roster, week of /).first()).toBeVisible();
  await soon(page.getByText(/Not final/).first()).toBeVisible();
  await soon(card(page, MINE)).toBeVisible();
  await expect(card(page, MINE).getByText("Bartender")).toBeVisible();
  await expect(
    card(page, MINE).getByRole("button", { name: "Accept" }),
  ).toBeVisible();
  await expect(page.getByText(/\$\d/)).toHaveCount(0);
  errors.expectNone();
});

test("accept (double tap), ask for a change, then say I cannot work it", async ({
  page,
}) => {
  const errors = watchApp(page);
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "shifts/drafts");
  await soon(card(page, MINE)).toBeVisible();

  await card(page, MINE).getByRole("button", { name: "Accept" }).dblclick();
  await soon(
    page.getByText("You said you can work this.").first(),
  ).toBeVisible();

  await card(page, MINE)
    .getByRole("button", { name: "Ask for a change" })
    .click();
  const why = unique("dentist");
  await card(page, MINE).getByLabel("Start time").fill("11:00");
  await card(page, MINE).getByLabel("End time").fill("15:00");
  await card(page, MINE).getByLabel("Reason (optional)").fill(why);
  await card(page, MINE)
    .getByRole("button", { name: "Send my request" })
    .click();
  await soon(page.getByText(/Waiting for your manager/).first()).toBeVisible();
  await soon(page.getByText(new RegExp(why)).first()).toBeVisible();

  // bad times are said in plain words and nothing is sent
  await card(page, MINE)
    .getByRole("button", { name: "Ask for a change" })
    .click();
  await card(page, MINE).getByLabel("Start time").fill("11am");
  await card(page, MINE)
    .getByRole("button", { name: "Send my request" })
    .click();
  await soon(page.getByText(/Write the dates like/)).toBeVisible();
  await card(page, MINE).getByRole("button", { name: "Back" }).click();

  await card(page, MINE)
    .getByRole("button", { name: "I can't work it" })
    .click();
  await card(page, MINE).getByLabel("Reason (optional)").fill("sick");
  await card(page, MINE)
    .getByRole("button", { name: "Send my answer" })
    .click();
  await soon(
    page.getByText(/You said you cannot work this\. Reason: sick/),
  ).toBeVisible();
  errors.expectNone();
});

test("once the manager decides a proposal the answer can no longer be changed", async ({
  page,
}) => {
  const v = await venuePath();
  const errors = watchApp(page);
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "shifts/drafts");
  await soon(card(page, MINE)).toBeVisible();
  await card(page, MINE)
    .getByRole("button", { name: "Ask for a change" })
    .click();
  await card(page, MINE).getByLabel("Start time").fill("12:00");
  await card(page, MINE).getByLabel("End time").fill("16:00");
  await card(page, MINE)
    .getByRole("button", { name: "Send my request" })
    .click();
  await soon(page.getByText(/Waiting for your manager/).first()).toBeVisible();

  const board = await must(
    api("manager", "GET", `${v}/roster/drafts/${draftId}/board`),
    "board",
  );
  const reply = (
    board.shifts as { reply: { id: string; response: string } | null }[]
  ).find((r) => r.reply?.response === "propose")?.reply;
  expect(reply, "the proposal on the board").toBeTruthy();
  await must(
    api(
      "manager",
      "POST",
      `${v}/roster/drafts/${draftId}/replies/${reply?.id}/decide`,
      { approve: true },
    ),
    "decide",
  );

  await page.reload();
  await soon(page.getByText(/Your manager agreed to/).first()).toBeVisible();
  await soon(page.getByText(/cannot be changed here/).first()).toBeVisible();
  await expect(
    card(page, MINE).getByRole("button", { name: "Accept" }),
  ).toHaveCount(0);
  errors.expectNone();
});

test("an open shift can be picked up, and the shifts page links to the drafts", async ({
  page,
}) => {
  const errors = watchApp(page);
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "shifts");
  await soon(
    page.getByRole("link", { name: "Draft rosters waiting for your reply" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Draft rosters waiting for your reply" })
    .click();
  await soon(
    page.getByRole("heading", { name: "Draft rosters", level: 1 }),
  ).toBeVisible();

  const pick = card(page, OPEN).getByRole("button", { name: "Pick this up" });
  if ((await pick.count()) === 0) return; // the venue's rule switches pick-ups off
  await pick.click();
  await soon(
    page
      .getByText(/You picked this shift up\.|You asked to pick this shift up/)
      .first(),
  ).toBeVisible();
  errors.expectNone();
});

test("a person with nothing out for them sees the empty sentence or only open shifts", async ({
  page,
}) => {
  const id = await signIn(page, "staff2");
  await openVenuePage(page, id, "shifts/drafts");
  await soon(
    page
      .getByText("No draft roster is waiting for your reply.")
      .or(
        page
          .getByRole("heading", { name: "Open shifts you could pick up" })
          .first(),
      ),
  ).toBeVisible();
});
