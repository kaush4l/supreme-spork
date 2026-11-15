import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";
import { watchCsp } from "./manager-ops-helpers";
import { personCard } from "./owner-support";

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

async function bondi(page: Page): Promise<string> {
  await page.goto("/");
  const href = await page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: /Bondi/ })
    .first()
    .getAttribute("href");
  return href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1] as string;
}

test("the Team page links to the new pages and each opens with real data", async ({
  browser,
}) => {
  const m = await as(browser, "manager");
  const watch = watchCsp(m.page);
  await openVenuePage(m.page, m.venue, "team");
  for (const [name, heading] of [
    ["People not on the team", "People not on the team"],
    ["Staff groups", "Staff groups"],
    ["Leave blackout dates", "Leave blackout dates"],
  ] as const) {
    await slow(m.page.getByRole("link", { name, exact: true })).toBeVisible();
    await m.page.getByRole("link", { name, exact: true }).click();
    await slow(
      m.page.getByRole("heading", { name: heading, level: 1 }),
    ).toBeVisible();
    await m.page.goBack();
  }
  await openVenuePage(m.page, m.venue, "team/unlinked");
  await slow(
    m.page
      .getByRole("button", { name: /^Add .* to the team$/ })
      .first()
      .or(m.page.getByText(/already on the team/)),
  ).toBeVisible();
  watch.expectNone();
  await m.context.close();
});

test("a role without the rights gets not found on every new page", async ({
  browser,
}) => {
  const s = await as(browser, "staff");
  for (const path of [
    "team/groups",
    "team/blackouts",
    "team/unlinked",
    "team/00000000-0000-4000-8000-000000000000",
  ]) {
    await openVenuePage(s.page, s.venue, path);
    await slow(s.page.getByText(NOT_FOUND).first()).toBeVisible();
  }
  await s.context.close();
});

test("a staff group: add, rename, add and remove a member, retire", async ({
  browser,
}) => {
  const m = await as(browser, "manager");
  const watch = watchCsp(m.page);
  const name = unique("Group");
  const renamed = `${name} B`;
  await openVenuePage(m.page, m.venue, "team/groups");
  await m.page.getByLabel("New group name").fill(name);
  await m.page.getByRole("button", { name: "Add group" }).dblclick();
  await slow(m.page.getByRole("heading", { name, level: 2 })).toHaveCount(1);
  const card = (n: string) =>
    m.page.getByRole("heading", { name: n, level: 2 }).locator("xpath=..");

  await card(name).getByLabel("Group name").fill(renamed);
  await card(name).getByRole("button", { name: "Rename" }).click();
  await slow(
    m.page.getByRole("heading", { name: renamed, level: 2 }),
  ).toBeVisible();

  await card(renamed)
    .getByRole("button", { name: /^Add a person/ })
    .click();
  await m.page.getByRole("option", { name: "Ana Silva" }).click();
  await card(renamed).getByRole("button", { name: "Add to group" }).dblclick();
  await slow(card(renamed).getByText("Ana Silva", { exact: true })).toHaveCount(
    1,
  );

  await card(renamed)
    .getByRole("button", { name: `Remove Ana Silva from ${renamed}` })
    .click();
  await slow(
    card(renamed).getByText("Nobody in this group yet."),
  ).toBeVisible();

  await m.page.getByRole("button", { name: `Retire ${renamed}` }).click();
  await m.page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Retire group" })
    .click();
  await slow(m.page.getByRole("heading", { name: renamed })).toHaveCount(0);
  watch.expectNone();
  await m.context.close();
});

test("a leave blackout: add once even on a double click, then remove after asking", async ({
  browser,
}) => {
  const m = await as(browser, "manager");
  const watch = watchCsp(m.page);
  const reason = unique("Blackout");
  await openVenuePage(m.page, m.venue, "team/blackouts");
  await m.page.getByLabel("First day").fill("2031-12-24");
  await m.page.getByLabel("Last day").fill("2031-12-26");
  await m.page.getByLabel(/^Reason/).fill(reason);
  await m.page.getByRole("button", { name: "Add blackout" }).dblclick();
  await slow(m.page.getByText(reason, { exact: true })).toHaveCount(1);
  await slow(
    m.page.getByText("2031-12-24 to 2031-12-26").first(),
  ).toBeVisible();

  const row = m.page
    .locator("div")
    .filter({ has: m.page.getByText(reason, { exact: true }) })
    .filter({ has: m.page.getByRole("button", { name: "Remove" }) })
    .last();
  await row.getByRole("button", { name: "Remove" }).click();
  await m.page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove" })
    .click();
  await slow(m.page.getByText(reason, { exact: true })).toHaveCount(0);
  watch.expectNone();
  await m.context.close();
});

test("a person's page: certificates recorded and put back, availability read-only for someone who signed in", async ({
  browser,
}) => {
  const m = await as(browser, "manager");
  const watch = watchCsp(m.page);
  await openVenuePage(m.page, m.venue, "team");
  await personCard(m.page, "Ana Silva")
    .getByRole("link", { name: "Certificates and availability" })
    .click();
  await slow(
    m.page.getByRole("heading", { name: "Ana Silva", level: 1 }),
  ).toBeVisible();
  await slow(
    m.page.getByRole("heading", { name: "Certificates", level: 2 }),
  ).toBeVisible();
  await slow(m.page.getByText("Only on your file").first()).toBeVisible();

  // Read what the venue holds for food safety, change it, then put it back.
  const line = await m.page
    .getByText(/^Your file: /)
    .first()
    .innerText();
  const [, original] = line.match(/^Your file: (.*)$/) ?? [];
  const number = original.includes(", ends ")
    ? original.split(", ends ")[0]
    : "";
  const date = original.split("ends ")[1];
  await m.page.getByRole("button", { name: "Correct Food safety" }).click();
  await m.page.getByLabel("Ends on").fill("2031-01-31");
  await m.page.getByRole("button", { name: "Save certificate" }).click();
  await slow(m.page.getByText(/Your file: .*ends 2031-01-31/)).toBeVisible();
  await m.page.getByRole("button", { name: "Correct Food safety" }).click();
  await m.page.getByLabel("Ends on").fill(date);
  await m.page.getByLabel("Number").fill(number);
  await m.page.getByRole("button", { name: "Save certificate" }).click();
  await slow(m.page.getByText(`Your file: ${original}`)).toBeVisible();

  // No sign-in yet: the manager can add and remove a venue entry.
  await slow(m.page.getByText(/have not signed in yet/)).toBeVisible();
  const note = unique("Note");
  await m.page.getByRole("combobox", { name: "Repeats" }).click();
  await m.page.getByRole("option", { name: "On certain dates" }).click();
  await m.page.getByLabel("First day").fill("2031-03-03");
  await m.page.getByLabel("Note").fill(note);
  await m.page.getByRole("button", { name: "Add entry" }).dblclick();
  await slow(m.page.getByText(new RegExp(note))).toHaveCount(1);
  await m.page
    .getByRole("button", { name: new RegExp(`Remove entry: .*${note}`) })
    .click();
  await slow(m.page.getByText(new RegExp(note))).toHaveCount(0);

  // Someone who has signed in: their rows are theirs and the page offers no form; the unlink question is asked first.
  await openVenuePage(m.page, m.venue, "team");
  await personCard(m.page, "Priya Nair")
    .getByRole("link", { name: "Certificates and availability" })
    .click();
  await slow(m.page.getByText(/manage them themselves/)).toBeVisible();
  await expect(m.page.getByRole("button", { name: "Add entry" })).toHaveCount(
    0,
  );
  await expect(
    m.page
      .getByRole("button", { name: "I have checked this" })
      .or(m.page.getByText("Checked").first())
      .first(),
  ).toBeVisible();
  await m.page.getByRole("button", { name: "Undo this link" }).click();
  await expect(m.page.getByRole("alertdialog")).toBeVisible();
  await m.page.keyboard.press("Escape");
  watch.expectNone();
  await m.context.close();
});

test("the empty Bondi venue shows the empty sentences", async ({ browser }) => {
  const o = await as(browser, "owner");
  const venue = await bondi(o.page);
  await openVenuePage(o.page, venue, "team/groups");
  await slow(
    o.page.getByText("No groups yet. Add the first one below."),
  ).toBeVisible();
  await openVenuePage(o.page, venue, "team/blackouts");
  await slow(o.page.getByText(/^No blackout dates/)).toBeVisible();
  await openVenuePage(o.page, venue, "team/unlinked");
  await slow(o.page.getByText(/already on the team/)).toBeVisible();
  await o.context.close();
});
