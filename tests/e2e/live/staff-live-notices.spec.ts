import { expect, test } from "@playwright/test";
import { openVenuePage, signIn, skipUnlessLive } from "../support/live";
import {
  api,
  cancelShift,
  type MadeShift,
  makeShift,
  must,
  noticeTotals,
  offerOpenShift,
  PRIYA,
  publishWeekOf,
  ruleValue,
  shownFrom,
  staffIds,
  venuePath,
  watchApp,
} from "../support/staff-api";

skipUnlessLive();
test.use({ actionTimeout: 15_000 });
// the staff logins are shared, so the tests of this file run one after the other
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);
const expectSoon = expect.configure({ timeout: 30_000 });

const TAKEN = /^Taken by someone else at \d{1,2}:\d{2} [ap]m$/;
const FILLED = /Filled by someone else at \d{1,2}:\d{2} [ap]m/;

/**
 * A shift of 9am to 1pm that two backup people (staff = Priya, staff2 = Tom) are told about. The demo's staff login
 * works as a bartender and staff2 as a waiter, so Priya is given the Waiter position for the length of this file
 * (put back in afterAll). Days that clash with one of their own shifts are skipped.
 */
async function offerToBoth(): Promise<{ shift: MadeShift; offerId: string }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const shift = await makeShift({
      position: "Waiter",
      open: true,
      hour: 9,
      hours: 4,
    });
    const answer = await offerOpenShift(shift.id);
    const eligible: string[] = answer.json?.eligible ?? [];
    if (
      answer.status < 300 &&
      eligible.includes(PRIYA) &&
      eligible.includes("Tom Becker")
    ) {
      made.push(shift.id);
      return { shift, offerId: answer.json.id as string };
    }
    if (answer.json?.id) await withdraw(answer.json.id as string);
    await cancelShift(shift.id);
  }
  throw new Error("could not find a day where both people could be told");
}

async function withdraw(offerId: string) {
  const v = await venuePath();
  await api("manager", "POST", `${v}/roster/offers/${offerId}/withdraw`);
}

/** staff2 asks for the shift; if the venue's rule needs a manager, the manager gives it to her. */
async function staff2Takes(shift: MadeShift, offerId: string) {
  const v = await venuePath();
  const got = await must(
    api("staff2", "POST", `${v}/me/offers/${offerId}/claim`, {}),
    "claim",
  );
  if (got.offer?.status !== "filled") {
    const board = await must(
      api("manager", "GET", `${v}/roster/offers`),
      "board",
    );
    const offer = (board.items ?? board).find(
      (o: { id: string }) => o.id === offerId,
    );
    await must(
      api(
        "manager",
        "POST",
        `${v}/roster/offers/${offerId}/claims/${offer.claims[0].id}/decide`,
        { approve: true },
      ),
      "decide",
    );
  }
  await publishWeekOf(shift.day);
}

async function setPositions(names: string[]) {
  const v = await venuePath();
  const id = (await staffIds())[PRIYA];
  await must(
    api("manager", "POST", `${v}/staff/${id}`, { position_names: names }),
    "positions",
  );
}

const made: string[] = [];
let original: string[] = [];
let taken: { shift: MadeShift; offerId: string };

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const rule = await ruleValue("pickup");
  if (rule === "no") return;
  const v = await venuePath();
  const id = (await staffIds())[PRIYA];
  const staff = await must(api("manager", "GET", `${v}/staff/${id}`), "staff");
  original = staff.position_names as string[];
  if (!original.includes("Waiter")) await setPositions([...original, "Waiter"]);
  taken = await offerToBoth();
  await staff2Takes(taken.shift, taken.offerId);
});

test.afterAll(async () => {
  for (const id of made) await cancelShift(id);
  if (taken) await withdraw(taken.offerId);
  if (original.length > 0) await setPositions(original);
});

test.beforeEach(async () => {
  test.skip(
    (await ruleValue("pickup")) === "no",
    "picking up shifts is switched off at the venue",
  );
});

test("a notice for a shift someone else took says so, is not new, and opens the offer page showing it", async ({
  page,
}) => {
  const errors = watchApp(page);
  const v = await venuePath();
  const shown = shownFrom(taken.shift);

  // what the backend says about the notice Priya was sent
  const list = await must(
    api("staff", "GET", `${v}/workflows/notifications?limit=200`),
    "notices",
  );
  const index = (
    list.items as { kind: string; target: { id: string | null } }[]
  ).findIndex(
    (n) => n.kind === "shift_offered" && n.target.id === taken.offerId,
  );
  expect(index, "the notice is in the newest 200").toBeGreaterThanOrEqual(0);
  const item = list.items[index];
  expect(item.state.live).toBe(false);
  expect(item.state.label).toMatch(FILLED);
  const offset = Math.floor(index / 20) * 20;

  const totals = await noticeTotals();
  expect(totals.unread).toBeGreaterThan(totals.liveUnread);

  const id = await signIn(page, "staff");
  await openVenuePage(page, id, `notices?offset=${offset}`);
  await expectSoon(
    page.getByRole("heading", { name: "Notices", level: 1 }),
  ).toBeVisible();
  const link = page.locator(`a[href$="/shifts/offers/${taken.offerId}"]`);
  await expectSoon(link).toBeVisible();
  await expect(link).toHaveText("See what happened");
  const card = page
    .locator("div")
    .filter({ has: link })
    .filter({ hasText: FILLED })
    .last();
  await expectSoon(card).toBeVisible();
  // the card is not shown as new, and the badge counts live notices only
  await expect(card).not.toContainText("New:");
  if (totals.liveUnread > 0)
    await expectSoon(
      page.getByText(`${totals.liveUnread} new`, { exact: true }),
    ).toBeVisible();
  else await expect(page.getByText(/\d+ new/)).toHaveCount(0);

  await link.click();
  await page.waitForURL(`**/shifts/offers/${taken.offerId}`);
  await expectSoon(
    page.getByRole("heading", { name: TAKEN, level: 2 }),
  ).toBeVisible();
  await expectSoon(page.getByText(shown.span).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask for this shift" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "See open shifts" }),
  ).toBeVisible();
  errors.expectNone();
});

test("the person who took it sees that they got it", async ({ page }) => {
  const id = await signIn(page, "staff2");
  await openVenuePage(page, id, `shifts/offers/${taken.offerId}`);
  await expectSoon(
    page.getByRole("heading", { name: "You got this shift", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask for this shift" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "See my shifts" })).toBeVisible();
});

test("a person who was never told about the offer gets not found", async ({
  page,
}) => {
  const v = await venuePath();
  const answer = await api("manager", "GET", `${v}/me/offers/${taken.offerId}`);
  expect(answer.status).toBe(404);
  const id = await signIn(page, "manager");
  // The page streams, so its HTTP status is already 200: what matters is that it says "not found" and shows no offer.
  await page.goto(`/venues/${id}/shifts/offers/${taken.offerId}`);
  await expect(
    page.getByText(/could not be found|not found/i).first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: "Ask for this shift" }),
  ).toHaveCount(0);
  await page.goto(`/venues/${id}/shifts/offers/not-an-offer`);
  await expect(
    page.getByText(/could not be found|not found/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test("an open offer can be asked for, and losing the race shows who is ahead", async ({
  page,
}) => {
  test.skip(
    (await ruleValue("pickup")) !== "first_come",
    "a lost race needs the first-come rule",
  );
  const errors = watchApp(page);
  const { shift, offerId } = await offerToBoth();
  try {
    const id = await signIn(page, "staff");
    await openVenuePage(page, id, `shifts/offers/${offerId}`);
    const ask = page.getByRole("button", { name: "Ask for this shift" });
    await expectSoon(ask).toBeVisible();
    await expectSoon(
      page.getByRole("heading", {
        name: "You can ask for this shift",
        level: 2,
      }),
    ).toBeVisible();

    // somebody else gets there first while this page is open
    await staff2Takes(shift, offerId);
    await ask.click();
    await expectSoon(
      page.getByText("This shift is no longer on offer."),
    ).toBeVisible();
    await expectSoon(
      page.getByRole("heading", { name: TAKEN, level: 2 }),
    ).toBeVisible();
    await expectSoon(ask).toHaveCount(0);
    errors.expectNone();
  } finally {
    await cancelShift(shift.id);
  }
});

test("phone width has no sideways scroll on the notices page or the offer page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await signIn(page, "staff");
  const overflow = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
  await openVenuePage(page, id, "notices");
  await expectSoon(
    page.getByRole("heading", { name: "Notices", level: 1 }),
  ).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await openVenuePage(page, id, `shifts/offers/${taken.offerId}`);
  await expectSoon(
    page.getByRole("heading", { name: TAKEN, level: 2 }),
  ).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
