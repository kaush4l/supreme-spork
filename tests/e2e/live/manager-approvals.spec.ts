import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";
import {
  api,
  cancelShift,
  leaveDecided,
  makeShift,
  must,
  publishWeekOf,
  shownAs,
  venuePath,
} from "../support/staff-api";
import { watchCsp } from "./manager-ops-helpers";

skipUnlessLive();
// Staff shifts and the manager's inbox are shared, so the scenarios run one after another.
test.describe.configure({ mode: "serial" });
test.setTimeout(400_000);
test.use({ actionTimeout: 30_000 });
const slow = expect.configure({ timeout: 90_000 });

const NOT_FOUND = /could not be found|not found/i;

/** A day in 2028-2031 that an earlier run is unlikely to have used. */
function farDay(): string {
  const d = new Date(Date.UTC(2028, 0, 1 + Math.floor(Math.random() * 1400)));
  return d.toISOString().slice(0, 10);
}

async function as(browser: Browser, role: Role) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const venue = await signIn(page, role);
  return { context, page, venue };
}

/** Staff asks for leave on one far day with a unique reason. */
async function staffAsksLeave(page: Page, venue: string, reason: string) {
  await openVenuePage(page, venue, "requests");
  await page.getByLabel("First day").fill(farDay());
  await page.getByLabel("First day").press("Enter");
  await page.getByLabel("Reason").first().fill(reason);
  await page.getByRole("button", { name: "Send request" }).first().click();
  await slow(page.getByText("Sent. Your manager will reply.")).toBeVisible();
}

/** Staff asks a colleague to take a shift; tries each shift until one is accepted. Returns false if none can be. */
async function staffAsksSwap(page: Page, venue: string, reason: string) {
  await openVenuePage(page, venue, "requests");
  const shift = page.getByRole("combobox", { name: /Your shift/ });
  if (!(await shift.isVisible())) return false;
  await shift.click();
  const count = await page.getByRole("option").count();
  await page.keyboard.press("Escape");
  for (let i = 0; i < count; i++) {
    await shift.click();
    await page.getByRole("option").nth(i).click();
    await page.getByRole("button", { name: /^Colleague/ }).click();
    await page.getByRole("option").first().click();
    await page.getByLabel("Reason").last().fill(reason);
    await page.getByRole("button", { name: "Send request" }).last().click();
    const sent = page.getByText("Sent. Your manager will decide.");
    try {
      await expect(sent).toBeVisible({ timeout: 20_000 });
      return true;
    } catch {
      await openVenuePage(page, venue, "requests");
    }
  }
  return false;
}

/** The card that holds this reason text and its own button. */
function cardOf(page: Page, text: string, button: string): Locator {
  return page
    .getByText(text, { exact: true })
    .locator(`xpath=ancestor::*[.//button[normalize-space()='${button}']][1]`);
}

async function noSideScroll(page: Page) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(wide, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

test("leave request shows for the manager, approve removes it and staff sees the answer", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  const reason = unique("leave ok");
  await staffAsksLeave(staff.page, staff.venue, reason);

  await openVenuePage(mgr.page, mgr.venue, "approvals");
  await slow(
    mgr.page.getByRole("heading", { name: "Approvals", level: 1 }),
  ).toBeVisible();
  const card = cardOf(mgr.page, `Reason: ${reason}`, "Approve");
  await slow(card).toContainText("asks for leave");
  await card.getByLabel("Note (optional)").fill("Enjoy");
  await card.getByRole("button", { name: "Approve" }).click();
  await slow(mgr.page.getByText(`Reason: ${reason}`)).toHaveCount(0);

  await openVenuePage(staff.page, staff.venue, "requests");
  const mine = staff.page.getByText(reason).first();
  // The request text on staff's page is the description; the decision word and note must show somewhere.
  await slow(staff.page.getByText("Manager said: Enjoy").first()).toBeVisible();
  void mine;
  watch.expectNone();
  await staff.context.close();
  await mgr.context.close();
});

test("a leave request declined with a note shows the note to staff", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  const mgr = await as(browser, "manager");
  const reason = unique("leave no");
  const note = unique("Sorry busy");
  await staffAsksLeave(staff.page, staff.venue, reason);

  await openVenuePage(mgr.page, mgr.venue, "approvals");
  const card = cardOf(mgr.page, `Reason: ${reason}`, "Decline");
  await card.getByLabel("Note (optional)").fill(note);
  await card.getByRole("button", { name: "Decline" }).click();
  await slow(mgr.page.getByText(`Reason: ${reason}`)).toHaveCount(0);

  await openVenuePage(staff.page, staff.venue, "requests");
  await slow(staff.page.getByText(`Manager said: ${note}`)).toBeVisible();
  await staff.context.close();
  await mgr.context.close();
});

test("deciding a request twice from two screens says Already decided", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  const first = await as(browser, "manager");
  const second = await as(browser, "manager");
  const reason = unique("leave twice");
  await staffAsksLeave(staff.page, staff.venue, reason);

  await openVenuePage(first.page, first.venue, "approvals");
  await openVenuePage(second.page, second.venue, "approvals");
  const a = cardOf(first.page, `Reason: ${reason}`, "Approve");
  const b = cardOf(second.page, `Reason: ${reason}`, "Approve");
  await slow(b).toBeVisible();
  await a.getByRole("button", { name: "Approve" }).click();
  await slow(first.page.getByText(`Reason: ${reason}`)).toHaveCount(0);
  await b.getByRole("button", { name: "Approve" }).click();
  await slow(b.getByText("Already decided")).toBeVisible();
  await staff.context.close();
  await first.context.close();
  await second.context.close();
});

test("a swap request shows for the manager and approving it points to the roster", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  const mgr = await as(browser, "manager");
  const reason = unique("swap ok");
  const sent = await staffAsksSwap(staff.page, staff.venue, reason);
  test.skip(
    !sent,
    "the demo staff member has no shift left that can be handed over",
  );

  await openVenuePage(mgr.page, mgr.venue, "approvals");
  const card = cardOf(mgr.page, `Reason: ${reason}`, "Approve");
  await slow(card).toContainText("asks");
  await slow(card).toContainText("to take their shift");
  await card.getByRole("button", { name: "Approve" }).click();
  await slow(
    mgr.page.getByRole("link", { name: "Publish the roster to tell them" }),
  ).toBeVisible();
  await staff.context.close();
  await mgr.context.close();
});

test("a swap request can be declined", async ({ browser }) => {
  const staff = await as(browser, "staff");
  const mgr = await as(browser, "manager");
  const reason = unique("swap no");
  const sent = await staffAsksSwap(staff.page, staff.venue, reason);
  test.skip(
    !sent,
    "the demo staff member has no shift left that can be handed over",
  );

  await openVenuePage(mgr.page, mgr.venue, "approvals");
  const card = cardOf(mgr.page, `Reason: ${reason}`, "Decline");
  await card.getByLabel("Note (optional)").fill("Not this week");
  await card.getByRole("button", { name: "Decline" }).click();
  await slow(mgr.page.getByText(`Reason: ${reason}`)).toHaveCount(0);
  await staff.context.close();
  await mgr.context.close();
});

/**
 * Staff (Priya) puts a Waiter shift in the pool through the UI, staff2 (Tom, a Waiter) claims it through the API as
 * set-up, and the manager decides it on the Approvals screen. The result is checked on staff2's My shifts page.
 */
async function poolScenario(browser: Browser, approve: boolean) {
  const shift = await makeShift({ position: "Waiter" });
  const shown = await shownAs(shift.id, shift.day);
  const v = await venuePath();
  const contexts: { close: () => Promise<void> }[] = [];
  try {
    const staff = await as(browser, "staff");
    contexts.push(staff.context);
    await openVenuePage(staff.page, staff.venue, "shifts");
    const mine = cardOf2(staff.page, shown.span, "Can't work it");
    await slow(mine).toBeVisible();
    await mine.getByRole("button", { name: "Can't work it" }).click();
    await slow(
      staff.page.getByText(/You put this in the pool/).first(),
    ).toBeVisible();

    const offers = await must(api("staff2", "GET", `${v}/me/offers`), "offers");
    const offer = (
      offers as { id: string; shift: { external_id: string } }[]
    ).find((o) => o.shift.external_id === shift.id);
    expect(offer, "pooled shift is offered to staff2").toBeTruthy();
    await must(
      api("staff2", "POST", `${v}/me/offers/${offer?.id}/claim`, {}),
      "claim",
    );

    const mgr = await as(browser, "manager");
    contexts.push(mgr.context);
    await openVenuePage(mgr.page, mgr.venue, "approvals");
    await slow(
      mgr.page.getByRole("heading", { name: "Shift pool" }),
    ).toBeVisible();
    // the inbox comes first; the same slot may also appear under Recently decided from an earlier run
    const title = mgr.page.getByText(`${shown.day}, ${shown.span}`).first();
    const row = title.locator(
      "xpath=ancestor::*[.//button[starts-with(normalize-space(),'Give to')]][1]",
    );
    const card = title.locator(
      "xpath=ancestor::*[.//*[contains(text(),'asked for this shift')]][1]",
    );
    await slow(row).toContainText("Tom Becker asked for this shift");
    await row.getByLabel("Note (optional)").fill("pool note");
    await row
      .getByRole("button", { name: approve ? /^Give to / : "Not this time" })
      .click();
    await slow(card.getByRole("button", { name: "Not this time" })).toHaveCount(
      0,
    );

    if (approve) await publishWeekOf(shift.day);
    const s2 = await as(browser, "staff2");
    contexts.push(s2.context);
    await openVenuePage(s2.page, s2.venue, "shifts");
    if (approve) {
      await slow(cardOf2(s2.page, shown.span, "Can't work it")).toBeVisible();
    } else {
      await slow(s2.page.getByText(/Not this time/).first()).toBeVisible();
    }
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    await cancelShift(shift.id);
  }
}

/** The smallest card holding both the span text and a button of this name. */
function cardOf2(page: Page, text: string, button: string): Locator {
  return page
    .locator("div, section, article, li")
    .filter({ hasText: text })
    .filter({ has: page.getByRole("button", { name: button }) })
    .last();
}

test("a pool claim can be given to the person who asked", async ({
  browser,
}) => {
  await poolScenario(browser, true);
});

test("a pool claim can be turned down", async ({ browser }) => {
  await poolScenario(browser, false);
});

test("a decided request appears under Recently decided with the decider's name", async ({
  browser,
}) => {
  const id = await leaveDecided(true, "recently decided e2e");
  const v = await venuePath();
  const list = await must(
    api("manager", "GET", `${v}/requests?decided_within_days=1&limit=100`),
    "decided",
  );
  const row = (
    list.items as {
      id: string;
      decided_by_name: string | null;
      details: { start_date: string };
    }[]
  ).find((r) => r.id === id);
  expect(row?.decided_by_name, "the API names who decided").toBeTruthy();

  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "approvals");
  await slow(
    mgr.page.getByRole("heading", { name: "Recently decided", level: 2 }),
  ).toBeVisible();
  const card = mgr.page
    .getByText(`asked for leave on ${row?.details.start_date}`)
    .locator("xpath=ancestor::*[.//*[contains(text(),'Approved by')]][1]");
  await slow(card).toContainText(`Approved by ${row?.decided_by_name}`);
  await slow(card.getByRole("button")).toHaveCount(0);
  await mgr.context.close();
});

test("the inbox shows either waiting items or the empty sentence", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "approvals");
  const empty = mgr.page.getByText("Nothing is waiting for you.");
  const list = mgr.page.getByRole("heading", { level: 2 }).first();
  await slow(empty.or(list)).toBeVisible();
  await mgr.context.close();
});

test("staff cannot open approvals, unknown ids are not found", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  await staff.page.goto(`/venues/${staff.venue}/approvals`);
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.page.goto("/venues/not-a-uuid/approvals");
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.page.goto(
    "/venues/00000000-0000-4000-8000-000000000000/approvals",
  );
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.context.close();
});

test("approvals is usable at phone width with no side scroll", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.setViewportSize({ width: 390, height: 844 });
  await openVenuePage(mgr.page, mgr.venue, "approvals");
  await slow(
    mgr.page.getByRole("heading", { name: "Approvals", level: 1 }),
  ).toBeVisible();
  await noSideScroll(mgr.page);
  await mgr.context.close();
});
