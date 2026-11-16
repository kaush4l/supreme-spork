import { type Browser, test } from "@playwright/test";
import { type Role, signIn, skipUnlessLive, unique } from "../support/live";
import { api, must, PRIYA, venuePath } from "../support/staff-api";
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

/** The manager records a wages payment for Priya through the cash book API; the note makes it findable. */
async function recordWagesFor(note: string, cents: number): Promise<string> {
  const v = await venuePath();
  const staff = await must(
    api("manager", "GET", `${v}/staff?limit=200`),
    "staff",
  );
  const priya = (staff.items as { name: string; staff_ref: string }[]).find(
    (s) => s.name === PRIYA,
  );
  if (!priya) throw new Error("Priya is not on the team");
  const made = await must(
    api("manager", "POST", `${v}/cash-book/payments`, {
      kind: "wages",
      amount_cents: cents,
      payee_staff_ref: priya.staff_ref,
      note,
    }),
    "record cash payment",
  );
  return made.id as string;
}

const note = unique("w4 cash");
let paymentId = "";

test("Priya sees a wages payment, confirms it once (a double click confirms once), and it shows as confirmed", async ({
  browser,
}) => {
  paymentId = await recordWagesFor(note, 23_456);
  const { context, page, venue } = await as(browser, "staff");
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, venue, "my-cash");
  await expect(
    page.getByRole("heading", { name: "My cash", level: 1 }),
  ).toBeVisible();
  // newest first: the payment just recorded, with amount, what it was for and a confirm button
  const card = page
    .locator("div")
    .filter({ hasText: note })
    .filter({ has: page.getByRole("button", { name: "I got this cash" }) })
    .last();
  await expect(card.getByText("$234.56")).toBeVisible();
  await expect(card.getByText(`Wages: ${note}`)).toBeVisible();
  await expect(card.getByText("Waiting for you to confirm")).toBeVisible();
  await expectNoSideScroll(page);

  await card.getByRole("button", { name: "I got this cash" }).dblclick();
  const done = page
    .locator("div")
    .filter({ hasText: note })
    .filter({ hasText: "Confirmed by you" })
    .last();
  await expect(done.getByText(/You confirmed it on /)).toBeVisible();
  await expect(
    done.getByRole("button", { name: "I got this cash" }),
  ).toHaveCount(0);
  await expect(errorBanner(page)).toHaveCount(0);

  // the backend agrees: confirmed, and the payment is there once
  const v = await venuePath();
  const mine = await must(
    api("staff", "GET", `${v}/me/cash-payments?limit=100`),
    "mine",
  );
  const rows = (mine.items as { id: string; status: string }[]).filter(
    (p) => p.id === paymentId,
  );
  expect(rows.map((r) => r.status)).toEqual(["confirmed"]);

  // confirming again from the API says so in plain words
  const again = await api(
    "staff",
    "POST",
    `${v}/me/cash-payments/${paymentId}/confirm`,
    {},
  );
  expect(again.status).toBe(409);
  await context.close();
});

test("someone else does not see it, and a role with no shifts finds no page", async ({
  browser,
}) => {
  const tom = await as(browser, "staff2");
  await open(tom.page, tom.venue, "my-cash");
  await expect(
    tom.page.getByRole("heading", { name: "My cash", level: 1 }),
  ).toBeVisible();
  await expect(tom.page.getByText(note)).toHaveCount(0);
  await tom.context.close();

  // staff2 may not confirm someone else's payment (404 from the backend)
  const v = await venuePath();
  const other = await api(
    "staff2",
    "POST",
    `${v}/me/cash-payments/${paymentId}/confirm`,
    {},
  );
  expect(other.status).toBe(404);

  const book = await as(browser, "bookkeeper");
  await open(book.page, book.venue, "my-cash");
  await expect(book.page.getByText(NOT_FOUND).first()).toBeVisible();
  await book.context.close();
});

test("a second, unconfirmed payment shows the waiting count and the notice leads to My cash", async ({
  browser,
}) => {
  const second = unique("w4 cash b");
  const secondId = await recordWagesFor(second, 1_000);
  const { context, page, venue } = await as(browser, "staff");
  await open(page, venue, "my-cash");
  await expect(
    page.getByText(/payments? (is|are) waiting for you to confirm/),
  ).toBeVisible();
  await expect(page.getByText(`Wages: ${second}`)).toBeVisible();

  await open(page, venue, "notices");
  await expect(
    page.locator('a[href$="/my-cash"]', { hasText: "Open" }).first(),
  ).toBeVisible();

  // tidy: confirm it so the demo person has nothing waiting from this run
  const v = await venuePath();
  await api("staff", "POST", `${v}/me/cash-payments/${secondId}/confirm`, {});
  await context.close();
});
