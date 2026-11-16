import { expect, type Page, test } from "@playwright/test";
import { openVenuePage, signIn, skipUnlessLive } from "../support/live";
import {
  api,
  cancelShift,
  dropShift,
  makeShift,
  must,
  offerOpenShift,
  publishWeekOf,
  ruleValue,
  shownAs,
  shownFrom,
  venuePath,
  watchApp,
} from "../support/staff-api";

skipUnlessLive();
test.use({ actionTimeout: 15_000 });
// the staff login is shared, so the tests of this file run one after the other
test.describe.configure({ mode: "serial" });
// the first load of a page compiles on the dev server, so waits after a refresh are longer than the 5 s default
test.setTimeout(120_000);
const expectSoon = expect.configure({ timeout: 30_000 });

/** The smallest element holding both the text and a button of this name. */
const cardWith = (page: Page, text: string, button: string) =>
  page
    .locator("div, section, article, li")
    .filter({ hasText: text })
    .filter({ has: page.getByRole("button", { name: button }) })
    .last();

test("shifts are grouped by day and can be put in the pool and taken back", async ({
  page,
}) => {
  const errors = watchApp(page);
  const shift = await makeShift({ position: "Manager" });
  try {
    const shown = await shownAs(shift.id, shift.day);
    const id = await signIn(page, "staff");
    await openVenuePage(page, id, "shifts");
    await expectSoon(
      page.getByRole("heading", { name: "My shifts", level: 1 }),
    ).toBeVisible();
    await expectSoon(page.getByText("The next 14 days.")).toBeVisible();
    await expectSoon(
      page.getByRole("heading", { name: shown.day, level: 2 }).first(),
    ).toBeVisible();

    const card = () => cardWith(page, shown.span, "Can't work it");
    await expectSoon(card()).toBeVisible();
    await card().getByRole("button", { name: "Can't work it" }).click();
    await expectSoon(
      page.getByText(
        "Put in the pool. It stays yours until someone is given it.",
      ),
    ).toBeVisible();
    await expectSoon(
      page
        .getByText(
          "You put this in the pool. It stays yours until a colleague is given it.",
        )
        .first(),
    ).toBeVisible();
    await expectSoon(
      page.getByRole("heading", { name: "Shifts you put in the pool" }),
    ).toBeVisible();

    await cardWith(page, shown.span, "Take it back")
      .getByRole("button", { name: "Take it back" })
      .first()
      .click();
    await expectSoon(cardWith(page, shown.span, "Can't work it")).toBeVisible();
    errors.expectNone();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a colleague claims a pooled shift and the manager decides (wording and result)", async ({
  browser,
}) => {
  const shift = await makeShift({ position: "Manager" });
  const v = await venuePath();
  try {
    const offerId = await dropShift(shift.id);
    const shown = shownFrom(shift);

    const other = await browser.newContext();
    const mgr = await other.newPage();
    const id = await signIn(mgr, "manager");
    await openVenuePage(mgr, id, "shifts");
    await expectSoon(
      mgr.getByRole("heading", { name: "Shifts you could pick up" }),
    ).toBeVisible();
    await expectSoon(
      mgr
        .getByText("Tap Claim to ask for it. Your manager decides who gets it.")
        .first(),
    ).toBeVisible();
    await expectSoon(mgr.getByText(/from Priya Nair/).first()).toBeVisible();
    const card = cardWith(mgr, shown.span, "Claim this shift");
    await card.getByRole("button", { name: "Claim this shift" }).click();
    await expectSoon(
      mgr.getByText("Waiting for a manager").first(),
    ).toBeVisible();
    await expectSoon(
      mgr.getByText("Waiting for a manager").first(),
    ).toBeVisible();

    // the manager gives it, and Priya no longer has it
    const board = await must(
      api("manager", "GET", `${v}/roster/offers`),
      "board",
    );
    const offer = (board.items ?? board).find(
      (o: { id: string }) => o.id === offerId,
    );
    const claim = offer.claims[0];
    await must(
      api(
        "manager",
        "POST",
        `${v}/roster/offers/${offerId}/claims/${claim.id}/decide`,
        { approve: true },
      ),
      "decide",
    );
    await publishWeekOf(shift.day);
    const has = async (role: "staff" | "manager") => {
      const list = await must(
        api(role, "GET", `${v}/me/shifts?from=${shift.day}&to=${shift.day}`),
        "shifts",
      );
      return (list as { external_id: string }[]).some(
        (x) => x.external_id === shift.id,
      );
    };
    expect(await has("manager")).toBe(true);
    expect(await has("staff")).toBe(false);
    // and on the colleague's page the shift is now in her own list, with no pool card left for it
    await openVenuePage(mgr, id, "shifts");
    await expectSoon(
      mgr.getByRole("button", { name: "Can't work it" }).first(),
    ).toBeVisible();
    await other.close();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a waiting request can be taken back", async ({ browser }) => {
  const shift = await makeShift({ position: "Manager" });
  try {
    await dropShift(shift.id);
    const shown = await shownAs(shift.id, shift.day);
    const other = await browser.newContext();
    const mgr = await other.newPage();
    const id = await signIn(mgr, "manager");
    await openVenuePage(mgr, id, "shifts");
    await cardWith(mgr, shown.span, "Claim this shift")
      .getByRole("button", { name: "Claim this shift" })
      .click();
    await expectSoon(
      mgr.getByText("Waiting for a manager").first(),
    ).toBeVisible();
    const take = cardWith(mgr, shown.span, "Take back my request");
    await take.getByRole("button", { name: "Take back my request" }).click();
    await expectSoon(
      mgr.getByText("Your request is taken back."),
    ).toBeVisible();
    await expectSoon(
      cardWith(mgr, shown.span, "Claim this shift").getByRole("button", {
        name: "Claim this shift",
      }),
    ).toBeVisible();
    await other.close();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a colleague (staff2) takes a claim back and the manager no longer sees it; asking again works", async ({
  browser,
}) => {
  const shift = await makeShift({ position: "Waiter" });
  const contexts: { close: () => Promise<void> }[] = [];
  try {
    const shown = await shownAs(shift.id, shift.day);
    await dropShift(shift.id);
    const c2 = await browser.newContext();
    contexts.push(c2);
    const t = await c2.newPage();
    const id = await signIn(t, "staff2");
    await openVenuePage(t, id, "shifts");
    const claim = () =>
      cardWith(t, shown.span, "Claim this shift").getByRole("button", {
        name: "Claim this shift",
      });
    await expectSoon(claim()).toBeVisible();
    await claim().click();
    await expectSoon(
      t.getByText("Waiting for a manager").first(),
    ).toBeVisible();

    const cm = await browser.newContext();
    contexts.push(cm);
    const m = await cm.newPage();
    const mid = await signIn(m, "manager");
    const listed = async () => {
      await openVenuePage(m, mid, "approvals");
      await expectSoon(
        m.getByRole("heading", { name: "Approvals", level: 1 }),
      ).toBeVisible();
      return m.getByText(`${shown.day}, ${shown.span}`).first();
    };
    await expectSoon(await listed()).toBeVisible();

    await cardWith(t, shown.span, "Take back my request")
      .getByRole("button", { name: "Take back my request" })
      .click();
    await expectSoon(t.getByText("Your request is taken back.")).toBeVisible();
    // the claim is gone from the manager's screen: the offer has no claim and no Give button
    const title = await listed();
    const row = title.locator(
      "xpath=ancestor::*[.//text()[contains(.,'Nobody has asked') or contains(.,'asked for this shift')]][1]",
    );
    await expectSoon(row).toContainText("Nobody has asked for it yet.");
    await expectSoon(
      row.getByRole("button", { name: /^Give to / }),
    ).toHaveCount(0);

    // asking again works
    await expectSoon(claim()).toBeVisible();
    await claim().click();
    await expectSoon(
      t.getByText("Waiting for a manager").first(),
    ).toBeVisible();
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    await cancelShift(shift.id);
  }
});

test("an open shift offered by the manager uses the venue's pickup wording", async ({
  browser,
}) => {
  const rule = await ruleValue("pickup");
  test.skip(rule === "no", "picking up shifts is switched off at the venue");
  const shift = await makeShift({ position: "Manager", open: true });
  try {
    expect((await offerOpenShift(shift.id)).status).toBeLessThan(300);
    const other = await browser.newContext();
    const mgr = await other.newPage();
    const id = await signIn(mgr, "manager");
    await openVenuePage(mgr, id, "shifts");
    const firstCome = rule === "first_come";
    await expectSoon(
      mgr
        .getByText(
          firstCome
            ? "First to claim gets it. It is yours as soon as you tap Claim."
            : "Tap Claim to ask for it. Your manager decides who gets it.",
        )
        .first(),
    ).toBeVisible();
    // the card of this shift, found by its day span (other open shifts may be on offer too)
    const shown = shownFrom(shift);
    await cardWith(mgr, shown.span, "Claim this shift")
      .getByRole("button", { name: "Claim this shift" })
      .click();
    if (firstCome)
      // taken at once: the shift is now one of mine
      await expectSoon(
        mgr.getByText("You got this shift").first(),
      ).toBeVisible();
    else
      await expectSoon(
        mgr.getByText("Waiting for a manager").first(),
      ).toBeVisible();
    await other.close();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a first-come claim says You got this shift, and still does after a reload", async ({
  browser,
}) => {
  const rule = await ruleValue("pickup");
  test.skip(rule !== "first_come", "pickup is not first come at the venue");
  const shift = await makeShift({ position: "Manager", open: true });
  try {
    expect((await offerOpenShift(shift.id)).status).toBeLessThan(300);
    const shown = shownFrom(shift);
    const other = await browser.newContext();
    const mgr = await other.newPage();
    const id = await signIn(mgr, "manager");
    await openVenuePage(mgr, id, "shifts");
    await cardWith(mgr, shown.span, "Claim this shift")
      .getByRole("button", { name: "Claim this shift" })
      .click();
    const got = mgr.getByText("You got this shift").first();
    await expectSoon(got).toBeVisible();
    await mgr.reload();
    await expectSoon(got).toBeVisible();
    // settled: no claim button is left on that card
    await expectSoon(cardWith(mgr, shown.span, "Claim this shift")).toHaveCount(
      0,
    );
    await other.close();
  } finally {
    await cancelShift(shift.id);
  }
});

test("empty states for a person with no shifts and nothing on offer", async ({
  page,
}) => {
  const v = await venuePath();
  const shifts = await must(api("manager", "GET", `${v}/me/shifts`), "shifts");
  const offers = await must(api("manager", "GET", `${v}/me/offers`), "offers");
  test.skip(
    shifts.length > 0 || offers.length > 0,
    "the manager login has shifts or offers right now",
  );
  const id = await signIn(page, "manager");
  await openVenuePage(page, id, "shifts");
  await expectSoon(
    page.getByText("You have no shifts coming up."),
  ).toBeVisible();
  await expectSoon(
    page.getByText("Nothing is on offer right now."),
  ).toBeVisible();
});

test("phone width has no sideways scroll, and an unknown venue is not found", async ({
  page,
}) => {
  const errors = watchApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const shift = await makeShift();
  try {
    const id = await signIn(page, "staff");
    await openVenuePage(page, id, "shifts");
    await expectSoon(
      page.getByRole("button", { name: "Can't work it" }).first(),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const response = await page.goto(
      "/venues/00000000-0000-4000-8000-000000000000/shifts",
    );
    expect(response?.status()).toBe(404);
    errors.expectNone();
  } finally {
    await cancelShift(shift.id);
  }
});
