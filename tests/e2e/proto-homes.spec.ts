import { expect, type Page, test } from "@playwright/test";

const EVID =
  "/Users/thusharsadhansabu/code/myprojects/minder-pass-documents/ui/redesign/phase-2/evidence/homes";

async function open(page: Page, path: string, scenario = "default") {
  await page.goto(
    `${path}${path.includes("?") ? "&" : "?"}scenario=${scenario}`,
  );
  await page.waitForLoadState("networkidle");
}
const main = (page: Page) => page.locator("main");
const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });

async function noOverflow(page: Page) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(over).toBe(false);
}

test.describe("V01 each persona enters Home", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("owner: urgent, today, last week with coverage, obligations", async ({
    page,
  }) => {
    await open(page, "/proto/owner/home");
    for (const h of [
      "Needs attention",
      "Today",
      "Last completed trading week",
      "Upcoming obligations",
    ])
      await expect(main(page).getByRole("heading", { name: h })).toBeVisible();
    await expect(
      main(page).getByText("Trading week 9-15 Nov").first(),
    ).toBeVisible();
    await expect(
      main(page).getByText(/Complete · Trading week 9-15 Nov · as of/),
    ).toBeVisible();
    await expect(page.getByTestId("metric-revenue")).toHaveText("$48,125.00");
    await expect(nav(page).getByRole("link")).toHaveText([
      "Home",
      "Team",
      "Operations",
      "Money",
    ]);
    await noOverflow(page);
    await page.screenshot({
      path: `${EVID}/owner-home-390.png`,
      fullPage: true,
    });
  });

  test("partner gets an owner-style home", async ({ page }) => {
    await open(page, "/proto/partner/home");
    await expect(
      main(page).getByRole("heading", { name: "Needs attention" }),
    ).toBeVisible();
    await expect(nav(page).getByRole("link")).toHaveText([
      "Home",
      "Team",
      "Operations",
      "Money",
    ]);
  });

  test("manager with money rights: Today plus linked money glance", async ({
    page,
  }) => {
    await open(page, "/proto/manager-money/home");
    for (const h of [
      "Staffing now",
      "Uncovered shifts",
      "Checks",
      "Exceptions",
      "Pending decisions",
      "Last completed trading week",
    ])
      await expect(main(page).getByRole("heading", { name: h })).toBeVisible();
    await expect(nav(page).getByRole("link")).toHaveText([
      "Home",
      "Team",
      "Operations",
      "Money",
    ]);
  });

  test("manager without money rights: no financial sections or forbidden links", async ({
    page,
  }) => {
    await open(page, "/proto/manager/home");
    await expect(
      main(page).getByRole("heading", { name: "Staffing now" }),
    ).toBeVisible();
    await expect(
      main(page).getByRole("heading", { name: "Last completed trading week" }),
    ).toHaveCount(0);
    await expect(main(page).getByText(/\$\d/)).toHaveCount(0);
    await expect(main(page).locator('a[href*="/money"]')).toHaveCount(0);
    await expect(page.locator('a[href*="/proto/manager/money"]')).toHaveCount(
      0,
    );
    await expect(nav(page).getByRole("link")).toHaveText([
      "Home",
      "Team",
      "Operations",
      "Inbox",
    ]);
    await page.screenshot({
      path: `${EVID}/manager-today-390.png`,
      fullPage: true,
    });
  });

  test("staff Today and bottom nav", async ({ page }) => {
    await open(page, "/proto/staff/home");
    for (const h of ["Your shift", "Checklist due", "Responses"])
      await expect(main(page).getByRole("heading", { name: h })).toBeVisible();
    await expect(main(page).getByText("Upload a docket")).toBeVisible();
    await expect(nav(page).getByRole("link")).toHaveText([
      "Today",
      "Shifts",
      "Inbox",
      "Me",
    ]);
    await page.screenshot({
      path: `${EVID}/staff-today-390.png`,
      fullPage: true,
    });
  });

  test("bookkeeper home: queues, age, coverage, exports, aggregate labour", async ({
    page,
  }) => {
    await open(page, "/proto/bookkeeper/home");
    for (const h of [
      "Review queues",
      "Oldest waiting",
      "Data coverage",
      "Labour evidence",
      "Exports",
    ])
      await expect(main(page).getByRole("heading", { name: h })).toBeVisible();
    await expect(page.getByTestId("oldest-age")).toHaveText("6 days");
    await expect(nav(page).getByRole("link")).toHaveText([
      "Home",
      "Money",
      "Inbox",
      "Me",
    ]);
    await page.screenshot({
      path: `${EVID}/bookkeeper-home-390.png`,
      fullPage: true,
    });
  });

  test("multi: staff mode shows Today, management mode shows manager Today", async ({
    page,
  }) => {
    await open(page, "/proto/multi/home");
    await expect(
      main(page).getByRole("heading", { name: "Your shift" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Management" }).click();
    await expect(
      main(page).getByRole("heading", { name: "Staffing now" }),
    ).toBeVisible();
    await expect(
      main(page).getByRole("heading", { name: "Last completed trading week" }),
    ).toHaveCount(0);
  });

  test("denied and empty states", async ({ page }) => {
    await open(page, "/proto/owner/home", "denied");
    await expect(
      main(page).getByText("Not available for your access").first(),
    ).toBeVisible();
    await open(page, "/proto/owner/home", "empty");
    await expect(
      main(page).getByText("All clear for this venue."),
    ).toBeVisible();
    await expect(page.getByTestId("metric-revenue")).toHaveText("$0.00");
  });
});

test.describe("V03 attention count", () => {
  test("busy: preview 5, count 120, View all keeps scope", async ({ page }) => {
    await open(page, "/proto/owner/home", "busy");
    await expect(page.getByTestId("urgent-count")).toHaveText(
      "120 items need attention",
    );
    await expect(main(page).getByText("Showing 5 of 120")).toBeVisible();
    const rows = main(page).locator(
      "section[aria-label='Needs attention'] ul li",
    );
    await expect(rows).toHaveCount(5);
    const viewAll = main(page).getByRole("link", { name: "View all 120" });
    await expect(viewAll).toHaveAttribute(
      "href",
      /\/proto\/owner\/inbox\?.*scope=urgent.*venue=v-harbour|\/proto\/owner\/inbox\?.*venue=v-harbour.*scope=urgent/,
    );
    await page.screenshot({
      path: `${EVID}/owner-busy-390.png`,
      fullPage: true,
    });
  });

  test("lower bound is labelled at least", async ({ page }) => {
    await open(page, "/proto/owner/home", "busy");
    await page.getByLabel("Venue").first().click();
    await page.getByRole("option", { name: /Swan River Bar/ }).click();
    await expect(page.getByTestId("urgent-count")).toHaveText(
      "At least 100 items need attention",
    );
    await expect(
      main(page).getByRole("link", { name: "View all (at least 100)" }),
    ).toHaveAttribute("href", /venue=v-perth/);
  });
});

test.describe("V04 drill-downs preserve filter and completeness", () => {
  test("finance rows link with the same week; missing stays Missing", async ({
    page,
  }) => {
    await open(page, "/proto/owner/home", "partial");
    await expect(page.getByTestId("metric-labour_cost")).toHaveText("Missing");
    await expect(page.getByTestId("metric-labour_cost")).not.toHaveText(/\$0/);
    await expect(
      main(page).getByText(/Partial · Trading week 9-15 Nov/),
    ).toBeVisible();
    const rev = main(page).getByRole("link", { name: /Revenue/ });
    await expect(rev).toHaveAttribute(
      "href",
      /\/proto\/owner\/money\/overview\?.*week=2026-11-09/,
    );
    const cogs = main(page).getByRole("link", { name: /Cost of goods/ });
    await expect(cogs).toHaveAttribute(
      "href",
      /money\/dockets\?from=2026-11-09&to=2026-11-15/,
    );
    const dockets = main(page).getByRole("link", { name: /Dockets to review/ });
    await expect(dockets).toHaveAttribute(
      "href",
      /money\/dockets\?status=needs_review/,
    );
  });

  test("a real zero stays 0 while missing never shows as 0", async ({
    page,
  }) => {
    await open(page, "/proto/owner/home");
    await expect(page.getByTestId("metric-cash_variance")).toHaveText("$0.00");
  });

  test("stale coverage banner", async ({ page }) => {
    await open(page, "/proto/owner/home", "stale");
    await expect(
      main(page).getByText("Some figures are out of date"),
    ).toBeVisible();
  });
});

test.describe("Manager Today grouping and Operations lists", () => {
  test("same issue shown once with related count; distinct failure kept", async ({
    page,
  }) => {
    await open(page, "/proto/manager/home");
    await expect(
      main(page).getByText("Fridge 2 temperature", { exact: true }),
    ).toHaveCount(1);
    await expect(
      main(page).getByText("3 related records (shown once)"),
    ).toBeVisible();
    await expect(
      main(page).getByText("Fridge 2 temperature check failed"),
    ).toHaveCount(0);
    await expect(
      main(page).getByText("Fridge 3 temperature check failed").first(),
    ).toBeVisible();
    await expect(
      main(page).getByText(/Not merged into the issue above: Fridge 3/),
    ).toBeVisible();
  });

  test("operations filtered list from a Home link", async ({ page }) => {
    await open(
      page,
      "/proto/manager/operations?kind=checks&status=failed&venue=v-harbour",
    );
    await expect(page.getByTestId("ops-count")).toHaveText("2 records");
    await expect(
      main(page).getByText("Fridge 3 temperature check failed"),
    ).toBeVisible();
    await expect(main(page).getByText("Opening checklist")).toHaveCount(0);
    await page.getByRole("link", { name: "Any status" }).click();
    await expect(page.getByTestId("ops-count")).toHaveText("8 records");
    await page.screenshot({
      path: `${EVID}/operations-390.png`,
      fullPage: true,
    });
  });

  test("operations denied for staff", async ({ page }) => {
    await open(page, "/proto/staff/operations");
    await expect(
      main(page).getByText("Not available for your access"),
    ).toBeVisible();
  });

  test("operations empty for empty venue filters", async ({ page }) => {
    await open(page, "/proto/manager/operations?kind=exceptions&status=failed");
    await expect(
      main(page).getByText("No records match these filters."),
    ).toBeVisible();
  });
});

test.describe("V02 staff clock and checklist", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("clock out: pending then success; duplicate click guarded", async ({
    page,
  }) => {
    await open(page, "/proto/staff/home");
    const btn = main(page).getByRole("button", { name: "Clock out" });
    await btn.click();
    await btn.click({ force: true }).catch(() => {});
    await expect(main(page).getByText("Clocking out")).toBeVisible();
    await expect(
      main(page).getByText("You are clocked out (simulated)."),
    ).toBeVisible();
    await expect(main(page).getByText(/Clocked out at 10:30 am/)).toBeVisible();
    await expect(
      main(page).getByRole("button", { name: "Clock out" }),
    ).toHaveCount(0);
  });

  test("clock in on an overnight day", async ({ page }) => {
    await open(page, "/proto/staff/home");
    await main(page).getByRole("button", { name: "Overnight shift" }).click();
    await expect(
      main(page)
        .getByText("Tue 17 Nov, 10:00 pm to 6:00 am Wed 18 Nov")
        .first(),
    ).toBeVisible();
    await main(page).getByRole("button", { name: "Clock in" }).click();
    await expect(
      main(page).getByText("You are clocked in (simulated)."),
    ).toBeVisible();
  });

  test("failed write preserves input; section retry then success", async ({
    page,
  }) => {
    await open(page, "/proto/staff/home", "error");
    await expect(
      main(page).getByText("Your shift could not be loaded"),
    ).toBeVisible();
    // Retry only this section; the rest stay in error.
    await main(page)
      .locator("section[aria-label='Your shift']")
      .getByRole("button", { name: "Retry" })
      .click();
    await main(page).getByRole("button", { name: "Missing clock-out" }).click();
    const t = main(page).getByLabel("Time you finished");
    await t.fill("6:15 pm");
    await main(page)
      .getByRole("button", { name: "Report missing clock-out" })
      .click();
    await expect(main(page).getByText(/Simulated failure/)).toBeVisible();
    await expect(t).toHaveValue("6:15 pm");
    await page.screenshot({
      path: `${EVID}/staff-error-preserved-390.png`,
      fullPage: true,
    });
    // Same input, next attempt succeeds once the scenario is back to default.
    await page.getByText("Prototype controls").click();
    await page.getByLabel("Scenario").first().click();
    await page.getByRole("option", { name: "Default" }).click();
    await expect(t).toHaveValue("6:15 pm");
    await main(page)
      .getByRole("button", { name: "Report missing clock-out" })
      .click();
    await expect(
      main(page).getByText("Missing clock-out reported (simulated)."),
    ).toBeVisible();
    await expect(
      main(page).getByText(/finished yesterday at 6:15 pm/),
    ).toBeVisible();
  });

  test("docket upload failure keeps file name and note", async ({ page }) => {
    await open(page, "/proto/staff/home");
    await page.locator('input[type="file"]').setInputFiles({
      name: "keep-me.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("x"),
    });
    await main(page).getByLabel("Note (optional)").fill("keep this note");
    await page.getByText("Prototype controls").click();
    await page.getByLabel("Scenario").first().click();
    await page.getByRole("option", { name: "Error" }).click();
    await main(page).getByRole("button", { name: "Send docket" }).click();
    await expect(main(page).getByText(/Simulated failure/)).toBeVisible();
    await expect(main(page).getByLabel("Note (optional)")).toHaveValue(
      "keep this note",
    );
    await expect(main(page).getByText("keep-me.pdf")).toBeVisible();
  });

  test("complete a due checklist item", async ({ page }) => {
    await open(page, "/proto/staff/home");
    await main(page)
      .getByRole("button", { name: "Complete Opening checklist" })
      .click();
    await expect(
      main(page).getByText("Completing Opening checklist"),
    ).toBeVisible();
    await expect(
      main(page).getByText("Opening checklist completed (simulated)."),
    ).toBeVisible();
    await expect(
      main(page).getByRole("button", { name: "Complete Opening checklist" }),
    ).toHaveCount(0);
  });

  test("day variants", async ({ page }) => {
    await open(page, "/proto/staff/home");
    await main(page).getByRole("button", { name: "No work today" }).click();
    await expect(
      main(page).getByText("No work today.", { exact: true }).first(),
    ).toBeVisible();
    await main(page).getByRole("button", { name: "Missing clock-out" }).click();
    await expect(
      main(page).getByText("You did not clock out of yesterday's shift."),
    ).toBeVisible();
    await main(page).getByRole("button", { name: "Late finish" }).click();
    await expect(
      main(page).getByText("This shift ran past its scheduled end."),
    ).toBeVisible();
  });

  test("docket upload quick action keeps input on failure and sends on success", async ({
    page,
  }) => {
    await open(page, "/proto/staff/home");
    await main(page).getByRole("button", { name: "Send docket" }).click();
    await expect(
      main(page).getByText("Choose a docket file first."),
    ).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: "harbour-fresh.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("x"),
    });
    await main(page).getByLabel("Note (optional)").fill("Fresh produce");
    await main(page).getByRole("button", { name: "Send docket" }).click();
    await expect(
      main(page).getByText(/harbour-fresh.pdf was sent for review/),
    ).toBeVisible();
    await expect(
      main(page).getByText("Sent for review · Fresh produce"),
    ).toBeVisible();
  });

  test("shifts page lists upcoming incl overnight", async ({ page }) => {
    await open(page, "/proto/staff/shifts");
    await expect(
      main(page).getByText("Fri 20 Nov, 10:00 pm to 6:00 am Sat 21 Nov"),
    ).toBeVisible();
    await expect(
      main(page).getByText("Overnight", { exact: true }),
    ).toBeVisible();
    await open(page, "/proto/staff/shifts", "empty");
    await expect(
      main(page).getByText(/You have no upcoming shifts/),
    ).toBeVisible();
  });
});

test.describe("V05 bookkeeper labour", () => {
  test("aggregate only, no named pay-rate fields", async ({ page }) => {
    await open(page, "/proto/bookkeeper/home");
    await expect(page.getByTestId("labour-aggregate")).toHaveText(
      "612.5 hours, $16,550.00 in total",
    );
    await expect(async () => {
      const b = main(page).getByRole("button", { name: "Labour detail" });
      if ((await b.getAttribute("aria-expanded")) !== "true") await b.click();
      await expect(
        main(page).getByText(/Aggregate for the whole venue/),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(
      main(page).getByText(/Aggregate for the whole venue/),
    ).toBeVisible();
    const text = (await main(page).innerText()).toLowerCase();
    for (const bad of [
      "hourly rate",
      "pay rate",
      "per hour",
      "/hr",
      "salary",
      "wage",
    ])
      expect(text).not.toContain(bad);
    await expect(
      main(page).getByRole("link", { name: "Open dockets (read-only)" }),
    ).toHaveAttribute("href", /\/proto\/bookkeeper\/money\/dockets/);
    await page.screenshot({
      path: `${EVID}/bookkeeper-labour-390.png`,
      fullPage: true,
    });
  });

  test("export is simulated: pending is visible (slow scenario), then ready", async ({
    page,
  }) => {
    await open(page, "/proto/bookkeeper/home", "slow");
    await main(page)
      .getByRole("button", { name: /Prepare export: Dockets CSV/ })
      .click({ timeout: 10000 });
    await expect(main(page).getByText(/Preparing Dockets CSV/)).toBeVisible();
    await expect(
      main(page).getByText(/is ready \(simulated, no file was created\)/),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe("V13 slow, failed section and retry", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("slow shows skeleton then content", async ({ page }) => {
    await open(page, "/proto/owner/home", "slow");
    await expect(main(page).getByText("Loading needs attention")).toBeVisible();
    await expect(main(page).getByText("Showing 5 of 7")).toBeVisible({
      timeout: 6000,
    });
  });

  test("loading shows skeleton until released", async ({ page }) => {
    await open(page, "/proto/manager/home", "loading");
    await expect(main(page).getByText("Loading staffing now")).toBeVisible();
    await page.getByText("Prototype controls").click();
    await page.getByRole("button", { name: "Finish loading" }).click();
    await expect(main(page).getByText(/rostered staff on shift/)).toBeVisible();
  });

  test("partial: one section fails, others usable, retry recovers only that section", async ({
    page,
  }) => {
    await open(page, "/proto/owner/home", "partial");
    await expect(
      main(page).getByText("Upcoming obligations could not be loaded"),
    ).toBeVisible();
    await expect(page.getByTestId("urgent-count")).toBeVisible();
    await expect(page.getByTestId("metric-revenue")).toBeVisible();
    await page.screenshot({
      path: `${EVID}/owner-partial-390.png`,
      fullPage: true,
    });
    await main(page).getByRole("button", { name: "Retry" }).click();
    await expect(main(page).getByText("BAS lodgement")).toBeVisible();
    await expect(
      main(page).getByText("Upcoming obligations could not be loaded"),
    ).toHaveCount(0);
    await expect(page.getByTestId("metric-labour_cost")).toHaveText("Missing");
  });

  test("manager partial: checks fail alone", async ({ page }) => {
    await open(page, "/proto/manager/home", "partial");
    await expect(
      main(page).getByText("Checks could not be loaded"),
    ).toBeVisible();
    await expect(main(page).getByText(/rostered staff on shift/)).toBeVisible();
    await main(page).getByRole("button", { name: "Retry" }).click();
    await expect(
      main(page).getByText("Fridge 3 temperature check failed").first(),
    ).toBeVisible();
  });
});

test.describe("V12 keyboard and 200% zoom", () => {
  test("tab order reaches controls with visible focus; no horizontal overflow at 200%", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/proto/staff/home");
    await expect(
      main(page).getByRole("heading", { name: "Your shift" }),
    ).toBeVisible();
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e) return null;
        const cs = getComputedStyle(e);
        return {
          name:
            e.getAttribute("aria-label") ||
            e.textContent?.trim().slice(0, 40) ||
            e.tagName,
          outline:
            cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
          shadow: cs.boxShadow !== "none",
        };
      });
      if (info) seen.push(info.name);
    }
    expect(seen.some((n) => /Clock out/.test(n))).toBe(true);
    expect(seen.some((n) => /Complete Opening checklist/.test(n))).toBe(true);
    expect(seen.some((n) => /Send docket/.test(n))).toBe(true);
    const clockIdx = seen.findIndex((n) => /Clock out/.test(n));
    const chkIdx = seen.findIndex((n) => /Complete Opening checklist/.test(n));
    const upIdx = seen.findIndex((n) => /Send docket/.test(n));
    expect(clockIdx).toBeLessThan(chkIdx);
    expect(chkIdx).toBeLessThan(upIdx);
  });

  test("focus lands on a stable status region after the pressed button is removed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/proto/staff/home");
    await main(page).getByRole("button", { name: "Clock out" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      main(page).getByText("You are clocked out (simulated)."),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id))
      .toBe("staff-clock-status");
    await main(page)
      .getByRole("button", { name: "Complete Opening checklist" })
      .focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id))
      .toBe("check-row-cl-1");
  });

  for (const persona of ["owner", "manager", "staff", "bookkeeper"]) {
    test(`200% zoom no clipping: ${persona}`, async ({ page }) => {
      await page.setViewportSize({ width: 195, height: 422 }); // 390x844 at 200% zoom
      await open(page, `/proto/${persona}/home`);
      await expect(main(page).getByRole("heading").first()).toBeVisible();
      await noOverflow(page);
      await page.screenshot({
        path: `${EVID}/${persona}-home-zoom200.png`,
        fullPage: true,
      });
    });
  }
});

test.describe("Desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("owner and manager desktop", async ({ page }) => {
    await open(page, "/proto/owner/home");
    await expect(
      main(page).getByRole("heading", { name: "Needs attention" }),
    ).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: `${EVID}/owner-home-1440.png`,
      fullPage: true,
    });
    await open(page, "/proto/manager/home");
    await noOverflow(page);
    await page.screenshot({
      path: `${EVID}/manager-today-1440.png`,
      fullPage: true,
    });
    await open(page, "/proto/staff/home");
    await page.screenshot({
      path: `${EVID}/staff-today-1440.png`,
      fullPage: true,
    });
  });
});
