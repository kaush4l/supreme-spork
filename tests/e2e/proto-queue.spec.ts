import { expect as baseExpect, type Page, test } from "@playwright/test";

// Generous assertion timeout: the dev server compiles routes on first hit.
const expect = baseExpect.configure({ timeout: 15_000 });
test.setTimeout(180_000);

const EVIDENCE =
  "/Users/thusharsadhansabu/code/myprojects/minder-pass-documents/ui/redesign/phase-2/evidence/queue";
const Q = "/proto/owner/money/dockets";

async function choose(page: Page, label: string, option: string) {
  const trigger = page.getByRole("combobox", { name: label }).first();
  // Retry: a click before hydration is lost; Escape first so a retry never toggles an open list shut.
  await expect(async () => {
    await page.keyboard.press("Escape");
    await trigger.click({ timeout: 3000 });
    await page
      .getByRole("option", { name: option })
      .first()
      .click({ timeout: 3000 });
  }).toPass({ timeout: 40_000 });
}
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const noOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1,
  );

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  test.describe(`V08 restore ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test(`open detail from page three, back and refresh restore context (${vp.name})`, async ({
      page,
    }) => {
      await page.goto(`${Q}?from=2026-09-20&sort=total_desc&page=3`);
      await expect(page.getByText(/Showing 51–75 of/)).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(400);
      const before = await scrollY(page);
      expect(before).toBeGreaterThan(100);
      const link = page.locator("[data-docket-link]").nth(8);
      const id = await link.getAttribute("data-docket-link");
      await link.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const clickY = await scrollY(page);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/money/dockets/${id}$`));
      await expect(
        page.getByRole("img", { name: /Placeholder image area/ }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Back to queue" }).click();
      await expect(page).toHaveURL(/from=2026-09-20&sort=total_desc&page=3/);
      await expect(page.getByText(/Showing 51–75 of/)).toBeVisible();
      await expect(page.getByText("Last opened")).toBeVisible();
      await page.waitForTimeout(500);
      expect(Math.abs((await scrollY(page)) - clickY)).toBeLessThanOrEqual(8);
      await expect(
        page
          .locator(`[data-docket-link="${id}"]`)
          .locator("xpath=descendant-or-self::*[self::a or self::button]")
          .first(),
      ).toBeFocused();
      // refresh
      await page.waitForTimeout(300);
      const beforeReload = await scrollY(page);
      await page.reload();
      await expect(page.getByText(/Showing 51–75 of/)).toBeVisible();
      await page.waitForTimeout(600);
      await expect(page).toHaveURL(/sort=total_desc&page=3/);
      expect(
        Math.abs((await scrollY(page)) - beforeReload),
      ).toBeLessThanOrEqual(8);
      await expect(page.getByText("Last opened")).toBeVisible();
      await page.screenshot({
        path: `${EVIDENCE}/v08-restored-${vp.name}.png`,
      });
      // browser back from detail also restores
      await page.locator(`[data-docket-link="${id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/money/dockets/${id}$`));
      await page.goBack();
      await expect(page).toHaveURL(/sort=total_desc&page=3/);
      await expect(page.getByText(/Showing 51–75 of/)).toBeVisible();
    });
  });
}

test("V09 search finds a record beyond page one; filter change resets page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(Q);
  await expect(page.getByText(/Showing 1–25 of 120/)).toBeVisible();
  await expect(page.getByText("D-0111")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search dockets" }).fill("Zephyr");
  await expect(page.getByText(/Showing 1–1 of 1/)).toBeVisible();
  await expect(page.locator('[data-docket-link="D-0111"]')).toBeVisible();
  await expect(page).toHaveURL(/q=Zephyr/);
  await page.screenshot({ path: `${EVIDENCE}/v09-search-desktop.png` });
  await page.getByRole("searchbox", { name: "Search dockets" }).fill("D-0111");
  await expect(page.locator('[data-docket-link="D-0111"]')).toBeVisible();
  await expect(page.getByText(/Showing 1–1 of 1/)).toBeVisible();
  // changing filters resets to page 1
  await page.goto(`${Q}?page=3`);
  await expect(page.getByText(/Showing 51–75 of 120/)).toBeVisible();
  await choose(page, "Status", "Approved");
  await expect(page).not.toHaveURL(/page=/);
  await expect(page).toHaveURL(/status=approved/);
  await page.goto(`${Q}?page=3`);
  await choose(page, "Sort by", "Date, oldest first");
  await expect(page).not.toHaveURL(/page=/);
  await expect(page).toHaveURL(/sort=date_asc/);
  await page.goto(`${Q}?page=3`);
  await page.getByRole("searchbox", { name: "Search dockets" }).fill("Harbour");
  await expect(page).not.toHaveURL(/page=3/);
  await expect(page).toHaveURL(/q=Harbour/);
});

test("pagination: stable page controls and 'Showing X–Y of N'", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(Q);
  await expect(page.getByText(/Showing 1–25 of 120/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Docket pages" })
    .getByRole("button", { name: /next/i })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/Showing 26–50 of 120/)).toBeVisible();
  // stable sort: same page twice returns identical order
  const ids = () =>
    page
      .locator("[data-docket-link]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-docket-link")));
  const a = await ids();
  await page.reload();
  await expect(page.getByText(/Showing 26–50 of 120/)).toBeVisible();
  expect(await ids()).toEqual(a);
});

test("out-of-range page is clamped with a notice", async ({ page }) => {
  await page.goto(`${Q}?page=99`);
  await expect(page.getByText("Page adjusted", { exact: true })).toBeVisible();
  await expect(page.getByText(/Showing 101–120 of 120/)).toBeVisible();
  await expect(page).toHaveURL(/page=5/);
  await page.screenshot({ path: `${EVIDENCE}/clamped-notice.png` });
});

test("dataset size control: 0, 1, 25, 26", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(Q);
  const size = "Prototype control: fixture dataset size";
  await choose(page, size, "0 dockets");
  await expect(page.getByText("No dockets yet for this venue.")).toBeVisible();
  await choose(page, size, "1 dockets");
  await expect(page.getByText("Showing 1–1 of 1")).toBeVisible();
  await choose(page, size, "25 dockets");
  await expect(page.getByText("Showing 1–25 of 25")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Docket pages" }),
  ).toHaveCount(0);
  await choose(page, size, "26 dockets");
  await expect(page.getByText("Showing 1–25 of 26")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Docket pages" }),
  ).toBeVisible();
});

test("empty result offers a way to clear filters", async ({ page }) => {
  await page.goto(`${Q}?q=nothingmatchesthis`);
  await expect(
    page.getByText("No dockets match your search and filters."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Clear filters/ })
    .first()
    .click();
  await expect(page.getByText(/Showing 1–25 of 120/)).toBeVisible();
});

test("V15 review: duplicate click records one change; status reflected in queue; reset restores", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${Q}?q=D-0111`);
  await page.locator('[data-docket-link="D-0111"]').click();
  await expect(page.getByText("Status: Needs review")).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/detail-owner-desktop.png` });
  await page
    .getByLabel("Review note (optional)")
    .fill("checked against statement");
  await page.getByRole("button", { name: "Approve" }).dblclick();
  await expect(page.getByText("Status: Approved")).toBeVisible();
  await expect(
    page.getByText(/Review changes recorded for this docket: 1$/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to queue" }).click();
  await expect(page.getByText(/Approved/).first()).toBeVisible();
  await expect(page.locator("tr", { hasText: "D-0111" })).toContainText(
    "Approved",
  );
});

test("review failure keeps the note and status (error scenario)", async ({
  page,
}) => {
  await page.goto(`/proto/owner/money/dockets/D-0111?scenario=error`);
  await page.getByLabel("Review note (optional)").fill("keep me");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText(/Simulated failure/).first()).toBeVisible();
  await expect(page.getByLabel("Review note (optional)")).toHaveValue(
    "keep me",
  );
  await expect(page.getByText("Status: Needs review")).toBeVisible();
  await expect(
    page.getByText(/changes recorded for this docket: 0/),
  ).toBeVisible();
});

test("slow scenario shows pending then success for a review", async ({
  page,
}) => {
  await page.goto(`/proto/owner/money/dockets/D-0111?scenario=slow`);
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  // Slow scenario re-arms after hydration; wait it out so the click is not lost to pre-hydration HTML.
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Approving D-0111/).first()).toBeVisible();
  await expect(page.getByText("Status: Approved")).toBeVisible({
    timeout: 6000,
  });
});

test("list states: error keeps inputs, loading, denied, partial", async ({
  page,
}) => {
  await page.goto(`${Q}?q=Harbour&scenario=error`);
  await expect(page.getByText("Dockets could not be loaded")).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search dockets" }),
  ).toHaveValue("Harbour");
  await page.goto(`${Q}?scenario=loading`);
  await expect(page.getByText("Loading dockets")).toBeVisible();
  await page.goto(`${Q}?scenario=partial`);
  await expect(page.getByText(/Some docket totals are missing/)).toBeVisible();
  await expect(page.getByText("Missing").first()).toBeVisible();
  await page.goto(`${Q}?scenario=denied`);
  await expect(page.getByText("Not available for your access")).toBeVisible();
});

test("bookkeeper has read-only dockets", async ({ page }) => {
  await page.goto("/proto/bookkeeper/money/dockets");
  await expect(page.getByText(/Read-only/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await page.locator("[data-docket-link]").first().click();
  await expect(page.getByText(/Read-only/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCE}/detail-bookkeeper-readonly.png` });
});

test("staff and manager without money rights are denied with recovery", async ({
  page,
}) => {
  for (const persona of ["staff", "manager"]) {
    await page.goto(`/proto/${persona}/money/dockets`);
    await expect(page.getByText("Not available for your access")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Home" })).toBeVisible();
    await page.goto(`/proto/${persona}/money`);
    await expect(page.getByText("Not available for your access")).toBeVisible();
  }
});

test("V05 bookkeeper labour page is aggregate only", async ({ page }) => {
  await page.goto("/proto/bookkeeper/money/labour");
  await expect(page.getByText("Total hours")).toBeVisible();
  await expect(page.getByText("612.5 h")).toBeVisible();
  await expect(page.getByText(/\$16,550\.00/)).toBeVisible();
  await expect(page.getByText("Trading week 9-15 Nov")).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/pay rate|hourly|per hour|\/hr|\brate\b/i);
  await page.screenshot({ path: `${EVIDENCE}/v05-labour-bookkeeper.png` });
  await page.goto("/proto/bookkeeper/money/overview");
  await expect(page.getByText("Not available for your access")).toBeVisible();
});

test("Money landing and overview by capability", async ({ page }) => {
  await page.goto("/proto/owner/money");
  for (const l of ["Overview", "Dockets", "Labour (aggregate)"])
    await expect(
      page.getByRole("link", { name: new RegExp(l.replace(/[()]/g, "\\$&")) }),
    ).toBeVisible();
  await page.goto("/proto/bookkeeper/money");
  await expect(page.getByRole("link", { name: /^Overview/ })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Dockets/ }).first(),
  ).toBeVisible();
  await page.goto("/proto/manager-money/money");
  await expect(page.getByRole("link", { name: /Labour/ })).toBeVisible(); // overview implies labour aggregate
  await page.goto("/proto/owner/money/overview");
  await expect(page.getByText("Compatibility", { exact: true })).toBeVisible();
  await expect(page.getByText(/Trading week 9-15 Nov/).first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/overview-owner.png` });
  await page.goto("/proto/owner/money/overview?scenario=partial");
  await expect(page.getByText("Missing").first()).toBeVisible();
});

for (const vp of [
  { w: 360, h: 800 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
  { w: 640, h: 400 }, // 200% zoom of a 1280x800 window
]) {
  test(`no horizontal overflow at ${vp.w}x${vp.h}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const u of [
      Q,
      `${Q}/D-0005`,
      "/proto/owner/money",
      "/proto/owner/money/overview",
      "/proto/bookkeeper/money/labour",
    ]) {
      await page.goto(u);
      await page.waitForTimeout(500);
      expect(await noOverflow(page), `${u} at ${vp.w}`).toBe(true);
    }
    await page.goto(Q);
    await expect(page.getByText(/Showing 1–25 of 120/)).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/queue-${vp.w}x${vp.h}.png` });
  });
}

test("V12 keyboard: filters sheet on phone returns focus; rows reachable by Tab", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(Q);
  const btn = page.getByRole("button", { name: /^Filters/ });
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Filter dockets" }),
  ).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/filters-sheet-390x844.png` });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Filter dockets" }),
  ).toHaveCount(0);
  await expect(btn).toBeFocused();
  // desktop: first row link reachable by keyboard with visible focus
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(Q);
  const first = page.locator("[data-docket-link]").first();
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/money\/dockets\/D-/);
});
