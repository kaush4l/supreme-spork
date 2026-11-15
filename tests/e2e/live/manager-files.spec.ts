import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
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

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** A small sales export dated 2001 (never the demo's weeks), made new on every call, with one line that cannot be read. */
function salesCsv() {
  return [
    "Date,Time,Order,Item,Channel,Qty,Gross,Discount,Void,Staff",
    `02/11/2001,11:20,T-${stamp()},Chicken Schnitzel,Dine In,1,29.00,0.00,,S07`,
    `02/11/2001,11:21,T-${stamp()},House Red Glass,Dine In,1,13.00,0.00,,S07`,
    "xx,junk",
  ].join("\n");
}

/** A small roster dated 2001 with a person who is not on the staff list and a line with no role. */
function rosterCsv() {
  const id = stamp();
  return [
    "Shift ID,Staff ID,Staff Name,Role,Start,End,Actual Start,Actual End,Break (min),Hourly Rate,Status",
    `SH-${id}-01,S99,Zed Newperson,Bartender,09/11/2001 17:00,09/11/2001 22:00,,,0,31.00,Filled`,
    `SH-${id}-02,S06,Jack Wu,,09/11/2001 12:00,09/11/2001 16:00,,,0,28.50,Filled`,
  ].join("\n");
}

async function pick(page: Page, name: string, body: string) {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(body) });
}

async function bondiId(page: Page) {
  await page.goto("/");
  const href = await page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: "Bondi" })
    .first()
    .getAttribute("href");
  return href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1] ?? "";
}

test("a manager uploads a sales export, sees why it needs a check, and rejects it with a reason", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "sales-files");
  await slow(
    mgr.page.getByRole("heading", { name: "Sales files", level: 1 }),
  ).toBeVisible();
  await pick(mgr.page, `own-sales-${stamp()}.csv`, salesCsv());
  await mgr.page.getByRole("button", { name: "Upload", exact: true }).click();
  await slow(mgr.page.getByText(/Check this: \d+ rows read/)).toBeVisible();
  await slow(mgr.page.getByText(/could not be read/).first()).toBeVisible();
  await mgr.page.getByRole("link", { name: "Look at this file" }).click();
  await slow(mgr.page.getByText("Why it was held back")).toBeVisible();
  await slow(mgr.page.getByText(/^Line 2:/)).toBeVisible();
  await slow(
    mgr.page.getByRole("link", { name: /Open the file/ }),
  ).toBeVisible();

  // reject needs a reason
  await mgr.page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(
    mgr.page.getByRole("button", { name: "Reject file" }),
  ).toBeDisabled();
  await mgr.page
    .getByLabel("Why is this file rejected?")
    .fill("Test file, not real sales");
  await mgr.page.getByRole("button", { name: "Reject file" }).dblclick();
  await slow(mgr.page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await slow(mgr.page.getByText(/Rejected|Set aside/i).first()).toBeVisible();

  // read again keeps working
  await mgr.page.getByRole("button", { name: "Read again" }).click();
  await slow(
    mgr.page.getByRole("heading", { name: "Rows read" }),
  ).toBeVisible();
  watch.expectNone();
  await mgr.context.close();
});

test("an owner uploads a delivery statement, approves it once with a double click, and sees it under all files", async ({
  browser,
}) => {
  const own = await as(browser, "owner");
  await openVenuePage(own.page, own.venue, "sales-files");
  await own.page.getByText("Delivery platform statement").click();
  await pick(own.page, `own-statement-${stamp()}.csv`, salesCsv());
  await own.page.getByRole("button", { name: "Upload", exact: true }).click();
  await slow(own.page.getByText(/rows read/).first()).toBeVisible();
  await own.page.getByRole("link", { name: "Look at this file" }).click();
  const approve = own.page.getByRole("button", {
    name: "Approve",
    exact: true,
  });
  await slow(approve).toBeVisible();
  await approve.dblclick();
  await slow(approve).toHaveCount(0);
  await slow(own.page.getByText(/booked|Done/i).first()).toBeVisible();
  await openVenuePage(own.page, own.venue, "sales-files");
  await own.page.getByRole("link", { name: "Show all files" }).click();
  await slow(
    own.page.getByRole("heading", { name: "All files" }),
  ).toBeVisible();
  await slow(
    own.page.getByText(/Check this|Done|Booked/).first(),
  ).toBeVisible();
  await own.context.close();
});

test("a bad type of file is refused in plain words", async ({ browser }) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "sales-files");
  await mgr.page.locator('input[type="file"]').setInputFiles({
    name: "x.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("a"),
  });
  await mgr.page.getByRole("button", { name: "Upload", exact: true }).click();
  await slow(mgr.page.getByText("Choose the file as a CSV.")).toBeVisible();
  await mgr.context.close();
});

test("a bookkeeper reads sales files but has no upload or buttons; roster files are not found", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await openVenuePage(bk.page, bk.venue, "sales-files");
  await slow(
    bk.page.getByRole("heading", { name: "Sales files", level: 1 }),
  ).toBeVisible();
  await expect(
    bk.page.getByRole("button", { name: "Upload", exact: true }),
  ).toHaveCount(0);
  await bk.page.getByRole("link", { name: "Show all files" }).click();
  await slow(bk.page.getByRole("heading", { name: "All files" })).toBeVisible();
  await bk.page.locator('a[href*="/sales-files/"]').first().click();
  await slow(bk.page.getByRole("heading", { name: "Rows read" })).toBeVisible();
  await expect(bk.page.getByRole("button", { name: "Read again" })).toHaveCount(
    0,
  );
  await expect(bk.page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await bk.page.goto(`/venues/${bk.venue}/roster-files`);
  await slow(bk.page.getByText(NOT_FOUND).first()).toBeVisible();
  const up = await bk.page.request.post(
    `/venues/${bk.venue}/roster-files/upload`,
    {
      multipart: {
        file: { name: "r.csv", mimeType: "text/csv", buffer: Buffer.from("a") },
      },
    },
  );
  expect([401, 403, 404]).toContain(up.status());
  await bk.context.close();
});

test("a manager uploads a roster, sees who is missing from the staff list, and approves it", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "roster-files");
  await slow(
    mgr.page.getByRole("heading", { name: "Roster files", level: 1 }),
  ).toBeVisible();
  await pick(mgr.page, `own-roster-${stamp()}.csv`, rosterCsv());
  await mgr.page.getByRole("button", { name: "Upload", exact: true }).click();
  await slow(mgr.page.getByText(/Check this: \d+ shifts read/)).toBeVisible();
  await mgr.page.getByRole("link", { name: "Look at this file" }).click();
  await slow(mgr.page.getByText("Why it was held back")).toBeVisible();
  await slow(
    mgr.page.getByText("People missing from the staff list"),
  ).toBeVisible();
  await slow(mgr.page.getByText(/Zed Newperson \(S99\)/)).toBeVisible();
  await slow(mgr.page.getByText(/^Line 2:/)).toBeVisible();
  const approve = mgr.page.getByRole("button", {
    name: "Approve",
    exact: true,
  });
  await approve.dblclick();
  await slow(approve).toHaveCount(0);
  watch.expectNone();
  await mgr.context.close();
});

test("a roster file can be rejected with a reason and read again", async ({
  browser,
}) => {
  const own = await as(browser, "owner");
  await openVenuePage(own.page, own.venue, "roster-files");
  await pick(own.page, `own-roster-${stamp()}.csv`, rosterCsv());
  await own.page.getByRole("button", { name: "Upload", exact: true }).click();
  await own.page.getByRole("link", { name: "Look at this file" }).click();
  await own.page.getByRole("button", { name: "Reject", exact: true }).click();
  await own.page.getByLabel("Why is this file rejected?").fill("Test roster");
  await own.page.getByRole("button", { name: "Reject file" }).click();
  await slow(own.page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await own.page.getByRole("button", { name: "Read again" }).click();
  await slow(
    own.page.getByRole("heading", { name: "Shifts read" }),
  ).toBeVisible();
  await own.context.close();
});

test("staff cannot open either screen; unknown ids are not found", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  for (const p of ["sales-files", "roster-files"]) {
    await staff.page.goto(`/venues/${staff.venue}/${p}`);
    await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  }
  await staff.page.goto(
    `/venues/${staff.venue}/roster-files/00000000-0000-4000-8000-000000000000`,
  );
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.context.close();
});

test("the empty Bondi venue shows the empty sentences, and phones have no side scroll", async ({
  browser,
}) => {
  const own = await as(browser, "owner");
  const bondi = await bondiId(own.page);
  expect(bondi).not.toBe("");
  await own.page.setViewportSize({ width: 390, height: 844 });
  await openVenuePage(own.page, bondi, "sales-files");
  await slow(own.page.getByText("No sales files need a check.")).toBeVisible();
  await openVenuePage(own.page, bondi, "roster-files");
  await slow(own.page.getByText("No roster files need a check.")).toBeVisible();
  const wide = await own.page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(wide).toBeLessThanOrEqual(0);
  await own.context.close();
});
