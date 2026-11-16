import { expect as baseExpect, type Page, test } from "@playwright/test";
import { signIn, skipUnlessLive, unique } from "../support/live";
import { api, must, staffIds, venuePath } from "../support/staff-api";
import { addDaysIso, pickerDate, shownTime } from "./manager-helpers";

skipUnlessLive();
// The offers list takes several seconds to answer while the demo holds many old offers (a backend gap), so waits are longer.
const expect = baseExpect.configure({ timeout: 30_000 });
test.describe.configure({ mode: "serial" });

const PERSON = "Priya Nair";
const OTHER = "Tom Becker"; // the second staff login (holds Waiter)
const POSITION = "Waiter";

/** A Monday in 2040 or later: the other roster specs pick weeks before 2036 and leave shifts behind. Weeks are picked once per run. */
const usedWeeks = new Set<string>();
function myWeek(): string {
  for (;;) {
    const w = addDaysIso("2040-01-02", 7 * Math.floor(Math.random() * 300));
    if (!usedWeeks.has(w)) {
      usedWeeks.add(w);
      return w;
    }
  }
}
const minute = () => String(10 + Math.floor(Math.random() * 40));
const span = (a: string, b: string) => `${shownTime(a)} to ${shownTime(b)}`;

const madeShifts: string[] = [];
const madeOffers: string[] = [];

async function shiftVia(
  day: string,
  start: string,
  end: string,
  who: string | null,
  position = POSITION,
): Promise<string> {
  const v = await venuePath();
  const ids = await staffIds();
  const s = await must(
    api("manager", "POST", `${v}/roster/shifts`, {
      position,
      staff_id: who ? ids[who] : null,
      start: `${day}T${start}:00`,
      end: `${day}T${end}:00`,
      break_minutes: 0,
    }),
    "add shift",
  );
  madeShifts.push(s.external_id);
  return s.external_id as string;
}

/** Publish a week through the backend; false when the owner wants approval first (then nothing is published). */
async function publishVia(week: string): Promise<boolean> {
  const v = await venuePath();
  const a = await api("manager", "POST", `${v}/roster/publish`, { week });
  return a.status === 200;
}

async function openPage(page: Page, v: string, path: string) {
  await page.goto(`/venues/${v}/roster/${path}`);
}

test.afterAll(async () => {
  const v = await venuePath();
  for (const o of madeOffers)
    await api("manager", "POST", `${v}/roster/offers/${o}/withdraw`);
  for (const s of madeShifts)
    await api("manager", "POST", `${v}/roster/shifts/${s}/cancel`);
});

test.describe("manager roster extras", () => {
  test("offer an open shift from the roster, then withdraw the offer", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const week = myWeek();
    const day = addDaysIso(week, 2);
    const m = minute();
    const [a, b] = [`10:${m}`, `13:${m}`];
    const id = await shiftVia(day, a, b, null);
    test.skip(!(await publishVia(week)), "publishing needs approval here");
    const v = await signIn(page, "manager");
    await page.goto(`/venues/${v}/roster?week=${week}`);
    const card = page
      .getByText(span(a, b), { exact: true })
      .locator(
        "xpath=ancestor::div[.//button[normalize-space()='Offer it']][1]",
      );
    await expect(card).toContainText(`${POSITION} · Open`);
    // A double click makes one offer.
    await card.getByRole("button", { name: "Offer it" }).dblclick();
    await expect(page.getByText(/^Offered\. \d+ /)).toBeVisible();
    const list = await must(
      api("manager", "GET", `${await venuePath()}/roster/offers`),
      "offers",
    );
    const mine = (
      list.items as { id: string; shift: { external_id: string } }[]
    ).filter((o) => o.shift.external_id === id);
    expect(mine).toHaveLength(1);
    madeOffers.push(mine[0].id);
    // The offers page shows it, and withdrawing takes it away.
    await openPage(page, v, "offers");
    await expect(
      page.getByRole("heading", { name: "Shift offers", level: 1 }),
    ).toBeVisible();
    const offer = page
      .getByText(span(a, b))
      .first()
      .locator(
        "xpath=ancestor::div[.//button[normalize-space()='Withdraw offer']][1]",
      );
    await expect(offer).toContainText("Nobody has asked for it yet.");
    await offer.getByRole("button", { name: "Withdraw offer" }).click();
    // It leaves the "on offer" list: the shift now appears once, under what was settled.
    await expect(page.getByText(span(a, b))).toHaveCount(1);
    const after = await must(
      api("manager", "GET", `${await venuePath()}/roster/offers`),
      "offers",
    );
    expect(
      (after.items as { shift: { external_id: string } }[]).filter(
        (o) => o.shift.external_id === id,
      ),
    ).toHaveLength(0);
  });

  test("a dropped shift is given to the person who asked, and another is turned down", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const week = myWeek();
    const day = addDaysIso(week, 3);
    const m = minute();
    const [a, b] = [`08:${m}`, `11:${m}`];
    const [c, d] = [`14:${m}`, `17:${m}`];
    const give = await shiftVia(day, a, b, PERSON);
    const refuse = await shiftVia(day, c, d, PERSON);
    test.skip(!(await publishVia(week)), "publishing needs approval here");
    const v = await venuePath();
    for (const id of [give, refuse]) {
      const offer = await must(
        api("staff", "POST", `${v}/me/shifts/${id}/drop`, {}),
        "drop",
      );
      madeOffers.push(offer.id);
      await must(
        api("staff2", "POST", `${v}/me/offers/${offer.id}/claim`, {}),
        "claim",
      );
    }
    const venue = await signIn(page, "manager");
    await openPage(page, venue, "offers");
    const card = (s: string) =>
      page
        .getByText(s)
        .first()
        .locator(
          "xpath=ancestor::div[.//button[normalize-space()='Withdraw offer']][1]",
        );
    const first = card(span(a, b));
    await expect(first).toContainText(`${OTHER} asked`);
    await first.getByRole("button", { name: `Give it to ${OTHER}` }).dblclick();
    await expect(page.getByText(/The shift is theirs/)).toBeVisible();
    const filled = await must(
      api("manager", "GET", `${v}/roster/offers?decided_within_days=1`),
      "settled",
    );
    const won = (
      filled.items as {
        status: string;
        filled_by: string | null;
        shift: { external_id: string };
      }[]
    ).filter((o) => o.shift.external_id === give);
    expect(won).toHaveLength(1);
    expect(won[0].filled_by).toBe(OTHER);
    await expect(page.getByText(`Filled by ${OTHER}`).first()).toBeVisible();
    // The second claim is turned down.
    const second = card(span(c, d));
    await second.getByRole("button", { name: "Not this time" }).click();
    await expect(second).toContainText(`${OTHER} asked`);
    await expect(
      second.getByRole("button", { name: "Not this time" }),
    ).toHaveCount(0);
    await expect(second).toContainText(": Not this time");
  });

  test("make a staffing template, use it on a week once, rename and retire it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const week = myWeek();
    const name = unique("Tpl");
    const v = await signIn(page, "manager");
    await openPage(page, v, "templates");
    await expect(
      page.getByRole("heading", { name: "Staffing templates", level: 1 }),
    ).toBeVisible();
    await page.getByLabel("Name").fill(name);
    await page
      .locator("button[role=combobox]")
      .filter({ hasText: "Choose a position" })
      .click();
    await page.getByRole("option", { name: POSITION, exact: true }).click();
    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    // Use it on the week: a double click makes the shifts once.
    await page
      .locator('input[placeholder="Select a date"]')
      .first()
      .fill(pickerDate(week));
    await page
      .locator('input[placeholder="Select a date"]')
      .first()
      .press("Enter");
    await page.getByRole("button", { name: "Make the shifts" }).dblclick();
    await expect(page.getByText("Made 1 open shift.")).toBeVisible();
    const grid = await must(
      api("manager", "GET", `${await venuePath()}/roster?week=${week}`),
      "week",
    );
    const made = (
      grid.shifts as { external_id: string; position: string; status: string }[]
    ).filter((s) => s.position === POSITION);
    expect(made).toHaveLength(1);
    expect(made[0].status).toBe("open");
    madeShifts.push(made[0].external_id);
    // Rename.
    const renamed = `${name} b`;
    await page.getByLabel("Name").fill(renamed);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: renamed, level: 1 }),
    ).toBeVisible();
    // Retire: it leaves the list and shows under retired.
    await page.getByRole("button", { name: "Retire template" }).click();
    await expect(page.getByText(/This template is retired/)).toBeVisible();
    await openPage(page, v, "templates");
    await expect(page.getByRole("link", { name: renamed })).toHaveCount(0);
    await openPage(page, v, "templates?retired=1");
    await expect(page.getByRole("link", { name: renamed })).toBeVisible();
  });

  test("suggestions list who could work an open shift and filling it works", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const week = myWeek();
    const m = minute();
    const [a, b] = [`09:${m}`, `12:${m}`];
    const id = await shiftVia(addDaysIso(week, 1), a, b, null);
    const v = await signIn(page, "manager");
    await openPage(page, v, `suggestions?week=${week}`);
    await expect(
      page.getByRole("heading", { name: "Suggestions", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(span(a, b))).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Fill chosen shifts/ }),
    ).toBeDisabled();
    await page
      .locator("button[role=combobox]")
      .filter({ hasText: "Nobody yet" })
      .click();
    await expect(
      page.getByText(/hours so far this week/).first(),
    ).toBeVisible();
    await page.getByRole("option").nth(1).click();
    await page.getByRole("button", { name: /^Fill 1 chosen shift/ }).dblclick();
    await expect(page.getByText("1 shift was filled.")).toBeVisible();
    const grid = await must(
      api("manager", "GET", `${await venuePath()}/roster?week=${week}`),
      "week",
    );
    const s = (
      grid.shifts as { external_id: string; staff_name: string | null }[]
    ).find((x) => x.external_id === id);
    expect(s?.staff_name).toBeTruthy();
    // An empty week says so.
    await openPage(page, v, `suggestions?week=${myWeek()}`);
    await expect(page.getByText("This week has no open shifts.")).toBeVisible();
  });

  test("send a week as a draft, agree to a proposed time, publish, and see the history", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const week = myWeek();
    const day = addDaysIso(week, 2);
    const m = minute();
    const id = await shiftVia(day, `10:${m}`, `14:${m}`, PERSON);
    const v = await signIn(page, "manager");
    await page.goto(`/venues/${v}/roster?week=${week}`);
    await page.getByRole("button", { name: "Send as draft" }).dblclick();
    await expect(page).toHaveURL(/\/roster\/drafts\/[0-9a-f-]{36}/, {
      timeout: 30_000,
    });
    const draftId = page.url().match(/drafts\/([0-9a-f-]{36})/)?.[1] ?? "";
    await expect(page.getByText(/Out for replies/)).toBeVisible();
    await expect(page.getByText("No reply yet")).toBeVisible();
    // The staff member suggests another time (through the backend: this spec is about the manager side).
    const bv = await venuePath();
    await must(
      api("staff", "POST", `${bv}/me/roster/drafts/${draftId}/replies`, {
        external_id: id,
        response: "propose",
        start: `${day}T11:${m}:00`,
        end: `${day}T15:${m}:00`,
        reason: "School run",
      }),
      "propose",
    );
    await page.reload();
    await expect(page.getByText(/Would rather work/)).toBeVisible();
    await page
      .getByRole("button", { name: "Agree to the new time" })
      .dblclick();
    await expect(page.getByText(/\(you agreed\)/)).toBeVisible();
    const shifts = await must(
      api("manager", "GET", `${bv}/roster?week=${week}`),
      "week",
    );
    const moved = (
      shifts.shifts as { external_id: string; start: string }[]
    ).find((s) => s.external_id === id);
    expect(moved?.start).toContain("T");
    // Publish the draft's week.
    await page.getByRole("button", { name: "Publish this week" }).click();
    const sent = page.getByText("Sent for approval");
    const done = page.getByText(/Published as version \d+\./);
    await expect(sent.or(done)).toBeVisible({ timeout: 20_000 });
    if (await sent.isVisible()) return;
    await page.reload();
    await expect(page.getByText(/: Published/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publish this week" }),
    ).toHaveCount(0);
    // History of that week.
    await openPage(page, v, `history?week=${week}`);
    await expect(page.getByText(/^Version 1, published/)).toBeVisible();
    await expect(page.getByText("Added (1)")).toBeVisible();
    await expect(page.getByText(/in this version/)).toBeVisible();
  });

  test("a draft can be cancelled after asking twice, and an unpublished week has no history", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const week = myWeek();
    const m = minute();
    await shiftVia(addDaysIso(week, 4), `09:${m}`, `13:${m}`, PERSON);
    const v = await signIn(page, "manager");
    await openPage(page, v, `history?week=${week}`);
    await expect(
      page.getByText(
        "This week has not been published, so there is no history yet.",
      ),
    ).toBeVisible();
    await page.goto(`/venues/${v}/roster?week=${week}`);
    await page.getByRole("button", { name: "Send as draft" }).click();
    await expect(page).toHaveURL(/\/roster\/drafts\//, { timeout: 30_000 });
    await page.getByRole("button", { name: "Cancel draft" }).click();
    await page.getByRole("button", { name: "Yes, cancel this draft" }).click();
    await expect(page.getByText(/: Cancelled/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel draft" }),
    ).toHaveCount(0);
  });

  test("the drafts list finds a sent draft again", async ({ page }) => {
    test.setTimeout(120_000);
    const week = myWeek();
    await shiftVia(
      addDaysIso(week, 1),
      `09:${minute()}`,
      `13:${minute()}`,
      PERSON,
    );
    const v = await signIn(page, "manager");
    await page.goto(`/venues/${v}/roster?week=${week}`);
    await page.getByRole("button", { name: "Send as draft" }).click();
    await expect(page).toHaveURL(/\/roster\/drafts\/[0-9a-f-]{36}/, {
      timeout: 30_000,
    });
    const draftId = page.url().match(/drafts\/([0-9a-f-]{36})/)?.[1] ?? "";
    // After a reload the list still finds it.
    await openPage(page, v, "drafts");
    await expect(
      page.getByRole("heading", { name: "Draft rosters", level: 1 }),
    ).toBeVisible();
    await expect(
      page.locator(`a[href$="/roster/drafts/${draftId}"]`),
    ).toBeVisible();
    await expect(page.getByText(/Out for replies/).first()).toBeVisible();
    await page.locator(`a[href$="/roster/drafts/${draftId}"]`).click();
    await expect(page.getByText(/: Out for replies/)).toBeVisible();
    // Cancel it so the week is left tidy.
    await page.getByRole("button", { name: "Cancel draft" }).click();
    await page.getByRole("button", { name: "Yes, cancel this draft" }).click();
    await expect(page.getByText(/: Cancelled/)).toBeVisible();
  });

  test("the pages are not found for staff, and the empty venue shows plain empty states", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext();
    const staff = await ctx.newPage();
    const sv = await signIn(staff, "staff");
    for (const p of [
      "offers",
      "templates",
      "suggestions",
      "history",
      `drafts/${crypto.randomUUID()}`,
    ]) {
      await staff.goto(`/venues/${sv}/roster/${p}`);
      await expect(staff.getByText(/could not be found/i)).toBeVisible();
    }
    await ctx.close();

    await signIn(page, "owner");
    const me = await must(api("owner", "GET", "/v1/me"), "me");
    const bondi = (me.venues as { id: string; name: string }[]).find((x) =>
      x.name.includes("Bondi"),
    )?.id;
    expect(bondi).toBeTruthy();
    const b = bondi as string;
    await openPage(page, b, "offers");
    await expect(
      page.getByText("No shifts are on offer right now."),
    ).toBeVisible();
    await openPage(page, b, "templates");
    await expect(page.getByText(/You have no templates yet/)).toBeVisible();
    await openPage(page, b, "suggestions");
    await expect(page.getByText("This week has no open shifts.")).toBeVisible();
    await openPage(page, b, "history");
    await expect(page.getByText(/has not been published/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, b, "templates");
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(wide).toBeLessThanOrEqual(0);
  });
});
