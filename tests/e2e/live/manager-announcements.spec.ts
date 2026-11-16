import { type Browser, type Page, test } from "@playwright/test";
import { type Role, signIn, skipUnlessLive, unique } from "../support/live";
import { api, must, venuePath } from "../support/staff-api";
import {
  errorBanner,
  expect,
  expectNoSideScroll,
  open,
  watch,
} from "./owner-support";

skipUnlessLive();
test.describe.configure({ mode: "serial", timeout: 240_000 });
test.use({ actionTimeout: 30_000 });

const NOT_FOUND = /could not be found|not found/i;

let errs: ReturnType<typeof watch>;
test.beforeEach(({ page }) => {
  errs = watch(page);
});
test.afterEach(() => errs.expectNone());

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
  const id = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1];
  expect(id, "the Bondi venue link").toBeTruthy();
  return id as string;
}

/** How many announcements with this exact title the manager's list has (a double click must make one). */
async function countTitled(title: string): Promise<number> {
  const v = await venuePath();
  const list = await must(
    api("manager", "GET", `${v}/announcements?limit=100`),
    "announcements",
  );
  return (list.items as { title: string }[]).filter((a) => a.title === title)
    .length;
}

const title = unique("Rota note");
let id = "";

test("a manager sends one to everyone (a double click sends once) and sees its receipts", async ({
  page,
}) => {
  const venue = await signIn(page, "manager");
  await open(page, venue, "announcements");
  await expect(
    page.getByRole("heading", { name: "Announcements", level: 1 }),
  ).toBeVisible();
  await page.getByRole("link", { name: "New announcement" }).click();
  await expect(
    page.getByRole("heading", { name: "New announcement", level: 1 }),
  ).toBeVisible();

  // nothing typed: a plain sentence, nothing sent
  await page.getByRole("button", { name: "Send announcement" }).click();
  await expect(page.getByText("Write a title.")).toBeVisible();

  await page.getByRole("textbox", { name: /^Title/ }).fill(title);
  await page
    .getByRole("textbox", { name: /^Message/ })
    .fill("Please check the roster before Friday.");
  // the audience starts as everyone
  await expect(
    page.getByText(/Everyone who works here and has an app login/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send announcement" }).dblclick();
  await expect(
    page.getByRole("heading", { name: title, level: 1 }),
  ).toBeVisible();
  id = page.url().match(/announcements\/([0-9a-f-]{36})/)?.[1] ?? "";
  expect(id, "the new announcement's id in the address").toBeTruthy();
  expect(await countTitled(title)).toBe(1);

  // receipts: read by N of M, and Priya (a demo login) not read yet
  await expect(page.getByText(/Read by 0 of \d+/)).toBeVisible();
  await expect(page.getByText("Priya Nair: Not read yet")).toBeVisible();
  await expect(page.getByText(/have no app login/)).toBeVisible();
  await expect(errorBanner(page)).toHaveCount(0);

  // the list shows it with "read by"
  await open(page, venue, "announcements");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("a person it was sent to sees it unread, opens it from the notice, and then it is read", async ({
  browser,
}) => {
  const { context, page, venue } = await as(browser, "staff");
  // staff see the staff view: no button to send
  await open(page, venue, "announcements");
  await expect(
    page.getByRole("heading", { name: "Announcements", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "New announcement" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: `New: ${title}` })).toBeVisible();

  // the notice links to it
  await open(page, venue, "notices");
  await expect(
    page.locator(`a[href$="/announcements/${id}"]`).first(),
  ).toBeVisible();

  await open(page, venue, "announcements");
  await page.getByRole("link", { name: `New: ${title}` }).click();
  await expect(
    page.getByRole("heading", { name: title, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Please check the roster before Friday."),
  ).toBeVisible();

  await open(page, venue, "announcements");
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: `New: ${title}` })).toHaveCount(
    0,
  );

  // sending is not for staff
  await open(page, venue, "announcements/new");
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
  await context.close();
});

test("the manager's receipts show it read, a second remind says to wait, and withdrawing shows staff the plain notice", async ({
  page,
  browser,
}) => {
  const venue = await signIn(page, "manager");
  await open(page, venue, `announcements/${id}`);
  await expect(page.getByText("Priya Nair: Read ")).toBeVisible();
  await expect(page.getByText(/Read by [1-9]\d* of \d+/)).toBeVisible();

  // remind the people who have not read it, then again: the backend's sentence is shown
  const remind = page.getByRole("button", {
    name: "Remind people who have not read it",
  });
  await remind.click();
  await expect(page.getByText(/(was|were) reminded\./)).toBeVisible();
  await expect(page.getByText(/^Reminded: /)).toBeVisible();
  await remind.click();
  await expect(page.getByText(/already reminded people today/)).toBeVisible();

  // withdraw, after a plain question
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await expect(page.getByText("Withdraw this announcement?")).toBeVisible();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByText("Withdraw this announcement?")).toHaveCount(0);
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page.getByRole("button", { name: "Yes, withdraw it" }).click();
  await expect(page.getByText(/^Withdrawn\. For:/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Withdraw", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remind people who have not read it" }),
  ).toHaveCount(0);

  const staff = await as(browser, "staff");
  await open(staff.page, staff.venue, `announcements/${id}`);
  await expect(
    staff.page.getByText("This announcement was withdrawn"),
  ).toBeVisible();
  await expect(
    staff.page.getByText("Please check the roster before Friday."),
  ).toHaveCount(0);
  await staff.context.close();
});

test("a role without the right sees the staff view, and an unknown id is not found", async ({
  browser,
}) => {
  const { context, page, venue } = await as(browser, "bookkeeper");
  await open(page, venue, "announcements");
  await expect(
    page.getByRole("heading", { name: "Announcements", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "New announcement" }),
  ).toHaveCount(0);
  await expect(page.getByText("No announcements yet.")).toBeVisible();
  await open(page, venue, "announcements/new");
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
  await open(page, venue, `announcements/${id}`);
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
  await context.close();
});

test("the owner's empty second venue says nothing was sent, and the pages fit a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const demo = await signIn(page, "owner");
  const empty = await bondi(page);
  await open(page, empty, "announcements");
  await expect(
    page.getByText("You have not sent any announcements yet."),
  ).toBeVisible();
  await expectNoSideScroll(page);
  await open(page, empty, "announcements/new");
  await expect(
    page.getByRole("heading", { name: "New announcement", level: 1 }),
  ).toBeVisible();
  await expectNoSideScroll(page);

  await open(page, demo, `announcements/${id}`);
  await expect(
    page.getByRole("heading", { name: title, level: 1 }),
  ).toBeVisible();
  await expectNoSideScroll(page);
});
