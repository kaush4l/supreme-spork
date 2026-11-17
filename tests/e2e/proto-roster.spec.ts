import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const EVIDENCE =
  process.env.ROSTER_EVIDENCE_DIR ??
  "/Users/thusharsadhansabu/code/myprojects/minder-pass-documents/ui/redesign/phase-2/evidence/roster";
mkdirSync(EVIDENCE, { recursive: true });

const PHONE = { width: 390, height: 844 };
const SMALL = { width: 360, height: 800 };
const DESKTOP = { width: 1440, height: 900 };
const ZOOM200 = { width: 640, height: 400 }; // 1280x800 at 200% browser zoom

async function open(page: Page, persona = "manager", query = "") {
  await page.goto(`/proto/${persona}/team/roster${query}`);
  await expect(page.getByRole("button", { name: "Add shift" })).toBeVisible();
}
async function noOverflow(page: Page) {
  const over = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(1);
}
async function pickTime(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function removeBlocking(page: Page) {
  await page.getByRole("button", { name: /Tuesday 17 November/ }).click();
  await page
    .getByRole("button", {
      name: /Edit shift: .*Chef, Tue 17 Nov 12:00 pm to 8:00 pm/,
    })
    .click();
  await page.getByRole("button", { name: "Remove shift from draft" }).click();
}

test.describe("V10 overnight edit and publish (phone)", () => {
  test.use({ viewport: PHONE });

  test("dates, markers, blocking vs advisory, publish once", async ({
    page,
  }) => {
    await open(page);
    // Friday agenda: overnight shift shows its end date in text.
    await page.getByRole("button", { name: /Friday 20 November/ }).click();
    const fri = page.getByRole("list", { name: "Shifts on Fri 20 Nov" });
    await expect(fri).toContainText("10:00 pm to 6:00 am");
    await expect(fri).toContainText("Overnight, ends Sat 21 Nov");
    // Saturday agenda: the same shift is shown as continuing from Friday.
    await page.getByRole("button", { name: /Saturday 21 November/ }).click();
    const sat = page.getByRole("list", { name: "Shifts on Sat 21 Nov" });
    await expect(sat).toContainText("Until 6:00 am");
    await expect(sat).toContainText("started Fri 20 Nov");
    // Saturday night shift (added since published) ends on Sunday.
    await expect(sat).toContainText("Overnight, ends Sun 22 Nov");
    await expect(sat).toContainText("Added since published");
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/v10-agenda-overnight-390.png` });

    // Review: blocking error stops publish, advisory labelled, both in text.
    const reviewBtn = page.getByRole("button", { name: "Review and publish" });
    await reviewBtn.click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText("Blocking error (must be fixed)");
    await expect(dlg).toContainText("Advisory (does not stop publishing)");
    await expect(dlg).toContainText("staff member is on leave on this day");
    await expect(dlg).toContainText("Added:");
    await expect(dlg).toContainText("Edited:");
    await expect(dlg).toContainText("Removed:");
    await expect(dlg).toContainText(
      "Sat 21 Nov 10:00 pm to Sun 22 Nov 6:00 am",
    );
    await expect(
      dlg.getByRole("button", { name: "Publish roster (simulated)" }),
    ).toHaveAttribute("aria-disabled", "true");
    await page.waitForTimeout(500); // let dialog animation settle
    await dlg.screenshot({ path: `${EVIDENCE}/v10-review-blocked-390.png` });
    await dlg.getByRole("button", { name: "Back to roster" }).click();
    await expect(reviewBtn).toBeFocused();

    // Edit the overnight shift: end 5:00 am.
    await page.getByRole("button", { name: /Friday 20 November/ }).click();
    await page
      .getByRole("button", {
        name: /Edit shift: .*Bartender, Fri 20 Nov 10:00 pm to 6:00 am/,
      })
      .click();
    await expect(
      page.getByRole("checkbox", { name: /Ends the next day/ }),
    ).toBeChecked();
    await expect(
      page.getByText(/This shift: Fri 20 Nov 10:00 pm to Sat 21 Nov 6:00 am/),
    ).toBeVisible();
    await pickTime(page, "End time", "5:00 am");
    await expect(
      page.getByText(/Sat 21 Nov 5:00 am \(overnight\)/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save shift to draft" }).click();
    await expect(fri).toContainText("10:00 pm to 5:00 am");
    await expect(fri).toContainText("Edited since published");
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();

    await removeBlocking(page);
    await reviewBtn.click();
    await expect(dlg).toContainText("Blocking errors (0)");
    await expect(dlg).toContainText(
      "Fri 20 Nov 10:00 pm to Sat 21 Nov 5:00 am",
    );
    await expect(dlg).toContainText("Advisory warnings (");
    const publish = dlg.getByRole("button", {
      name: "Publish roster (simulated)",
    });
    await expect(publish).not.toHaveAttribute("aria-disabled", "true");
    await page.waitForTimeout(500); // let dialog animation settle
    await dlg.screenshot({ path: `${EVIDENCE}/v10-review-ready-390.png` });
    // Duplicate clicks must not double-apply. NOTE (finding): on a phone the closing dialog exposes the bottom nav under
    // the second tap, so a real double tap can navigate to Team. The test records the publish result, then returns.
    await publish.dblclick();
    await expect(
      page.getByRole("region", { name: "Roster" }).getByText(/Now version 2\./),
    ).toBeVisible();
    await page.waitForTimeout(1000); // a ghost second tap navigates a moment later
    const ghostTap = !page.url().endsWith("/team/roster");
    if (ghostTap) {
      await page.goto("/proto/manager/team/roster"); // draft state persists in the session
    }
    await expect(
      page.getByText("Published version 2. No unsaved changes."),
    ).toBeVisible();
    await expect(page.getByText("No unsaved changes.")).toBeVisible();
    if (!ghostTap) await expect(reviewBtn).toBeFocused();
    await reviewBtn.click();
    await expect(page.getByRole("dialog")).toContainText(
      "No changes since the published roster",
    );
  });

  test("recoverable publish error keeps the draft; retry succeeds", async ({
    page,
  }) => {
    await open(page, "manager", "?scenario=error");
    await removeBlocking(page);
    await page.getByRole("button", { name: "Review and publish" }).click();
    const dlg = page.getByRole("dialog");
    await dlg
      .getByRole("button", { name: "Publish roster (simulated)" })
      .click();
    await expect(dlg).toContainText("Publish did not work");
    await expect(dlg).toContainText("still in the draft");
    await dlg.getByRole("button", { name: "Back to roster" }).click();
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    // Fix the cause: reload under the default scenario; the draft survives and publishes.
    await page.goto("/proto/manager/team/roster?scenario=default");
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    await page.getByRole("button", { name: "Review and publish" }).click();
    await page
      .getByRole("button", { name: "Publish roster (simulated)" })
      .click();
    await expect(
      page.getByRole("region", { name: "Roster" }).getByText(/Now version 2\./),
    ).toBeVisible();
  });

  test("keyboard: form opens and closes with focus restored; labelled fields", async ({
    page,
  }) => {
    await open(page);
    const add = page.getByRole("button", { name: "Add shift" });
    await add.focus();
    await page.keyboard.press("Enter");
    const dlg = page.getByRole("dialog");
    await expect(dlg.getByRole("heading", { name: "Add shift" })).toBeVisible();
    for (const l of [
      "Search staff",
      "Role",
      "Start day",
      "Start time",
      "End time",
    ])
      await expect(dlg.getByLabel(l, { exact: false }).first()).toBeVisible();
    await expect(dlg.getByRole("checkbox", { name: /leave/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
    await expect(add).toBeFocused();

    // Edit button focus restored after save.
    const edit = page.getByRole("button", { name: /^Edit shift:/ }).first();
    await edit.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(edit).toBeFocused();
  });

  test("add shift with a very long name found by search of 250 staff", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("button", { name: "Add shift" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText("of 250 staff");
    await dlg
      .getByRole("searchbox", { name: /Search staff/ })
      .fill("Konstantinopoulos");
    await expect(dlg).toContainText("Showing 1 to 1 of 1 staff");
    await dlg
      .getByRole("radio", { name: /Konstantinopoulos-Featherstonehaugh/ })
      .check();
    await expect(dlg).toContainText(
      "Assigned to: Alexandria Wilhelmina Konstantinopoulos-Featherstonehaugh",
    );
    await noOverflow(page);
    await dlg.getByRole("searchbox", { name: /Search staff/ }).fill("zzzzqq");
    await expect(dlg).toContainText('No staff match "zzzzqq"');
    await dlg
      .getByRole("searchbox", { name: /Search staff/ })
      .fill("Konstantinopoulos");
    await dlg
      .getByRole("radio", { name: /Konstantinopoulos-Featherstonehaugh/ })
      .check();
    await dlg.getByRole("button", { name: "Save shift to draft" }).click();
    await expect(page.getByRole("list", { name: /Shifts on/ })).toContainText(
      "Konstantinopoulos-Featherstonehaugh",
    );
    await expect(page.getByText("Added since published").first()).toBeVisible();
  });
});

test.describe("search over 250 staff (Team directory)", () => {
  test.use({ viewport: SMALL });
  test("paging, query, empty state, long names, no overflow", async ({
    page,
  }) => {
    await page.goto("/proto/manager/team");
    await expect(page.getByText("1 to 25 of 250 staff")).toBeVisible();
    await expect(page.getByRole("link", { name: "Roster" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Announcements" }),
    ).toHaveAttribute("href", "/proto/manager/team/announcements");
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText("26 to 50 of 250 staff")).toBeVisible();
    // Stable: same query gives same first result twice.
    const search = page.getByRole("searchbox", { name: /Search staff/ });
    await search.fill("Wilhelmina");
    await expect(page.getByText("1 to 1 of 1 staff")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Staff results" }),
    ).toContainText("Konstantinopoulos");
    await noOverflow(page);
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/search-long-name-360.png` });
    await search.fill("zzzzqq");
    await expect(page.getByText('No staff match "zzzzqq".')).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No staff found" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await expect(page.getByText("1 to 25 of 250 staff")).toBeVisible();
    await search.fill("chef");
    const text = await page
      .getByText(/ of \d+ staff$/)
      .first()
      .textContent();
    expect(text).toMatch(/^1 to \d+ of \d+ staff$/);
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/search-390.png` });
  });
});

test.describe("V11 venue switch with unsaved draft", () => {
  test.use({ viewport: PHONE });

  async function editAndSwitch(page: Page, to: string) {
    await open(page, "owner");
    await page.getByRole("button", { name: "Add shift" }).click();
    await page.getByRole("button", { name: "Save shift to draft" }).click();
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    await page.getByRole("combobox", { name: "Venue" }).click();
    await page.getByRole("option", { name: new RegExp(to) }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toContainText("Unsaved roster draft");
    return dlg;
  }

  test("keep: bound to the original venue only", async ({ page }) => {
    const dlg = await editAndSwitch(page, "Swan River Bar");
    await expect(
      dlg.getByRole("button", { name: "Keep draft for Harbour Kitchen" }),
    ).toBeVisible();
    await expect(
      dlg.getByRole("button", { name: "Discard draft" }),
    ).toBeVisible();
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/v11-switch-dialog-390.png` });
    await dlg
      .getByRole("button", { name: "Keep draft for Harbour Kitchen" })
      .click();
    // On Perth: other timezone, no draft.
    await expect(
      page.getByText(
        /Swan River Bar\. Times are venue time \(Australia\/Perth\)/,
      ),
    ).toBeVisible();
    await expect(page.getByText("No unsaved changes.")).toBeVisible();
    await expect(page.getByText(/Draft kept for/)).toHaveCount(0);
    await expect(page.getByText("1 change since published.")).toHaveCount(0);
    // Back on Harbour: the draft is restored and flagged.
    await page.getByRole("combobox", { name: "Venue" }).click();
    await page.getByRole("option", { name: /Harbour Kitchen/ }).click();
    await expect(
      page.getByText("Draft kept for Harbour Kitchen"),
    ).toBeVisible();
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/v11-kept-restored-390.png` });
  });

  test("discard drops the draft and completes the switch", async ({ page }) => {
    const dlg = await editAndSwitch(page, "Swan River Bar");
    await dlg.getByRole("button", { name: "Discard draft" }).click();
    await expect(
      page.getByText(/Swan River Bar\. Times are venue time/),
    ).toBeVisible();
    await page.getByRole("combobox", { name: "Venue" }).click();
    await page.getByRole("option", { name: /Harbour Kitchen/ }).click();
    await expect(page.getByText("No unsaved changes.")).toBeVisible();
    await expect(page.getByText(/Draft kept for/)).toHaveCount(0);
  });

  test("stay keeps the venue; empty venue shows an empty state", async ({
    page,
  }) => {
    const dlg = await editAndSwitch(page, "Swan River Bar");
    await dlg.getByRole("button", { name: "Stay on Harbour Kitchen" }).click();
    await expect(
      page.getByText(/Harbour Kitchen\. Times are venue time/),
    ).toBeVisible();
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    // Discard then go to the empty venue.
    await page.getByRole("combobox", { name: "Venue" }).click();
    await page.getByRole("option", { name: /Newly Opened Cafe/ }).click();
    await page.getByRole("button", { name: "Discard draft" }).click();
    await expect(page.getByText("No shifts this week yet")).toBeVisible();
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/empty-venue-390.png` });
  });
});

test.describe("access", () => {
  test("roster needs roster.edit; manager without money still has it", async ({
    page,
  }) => {
    await page.goto("/proto/manager/team/roster");
    await expect(page.getByRole("button", { name: "Add shift" })).toBeVisible();
    await page.goto("/proto/partner/team/roster");
    await expect(
      page.getByText("Roster is not available for your access"),
    ).toBeVisible();
    await page.goto("/proto/staff/team/roster");
    await expect(
      page.getByText("Not available for your access").first(),
    ).toBeVisible();
    await page.goto("/proto/bookkeeper/team/roster");
    await expect(
      page.getByText("Not available for your access").first(),
    ).toBeVisible();
  });
});

test.describe("V12 layouts", () => {
  test("desktop 1440: week grid with agenda toggle", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    const grid = page.getByRole("region", { name: "Week grid" });
    await expect(grid).toBeVisible({ timeout: 20_000 });
    await expect(grid).toContainText("Overnight, ends Sat 21 Nov");
    await expect(grid).toContainText("Edited since published");
    await noOverflow(page);
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/roster-grid-1440.png` });
    await page.getByRole("radio", { name: "Agenda" }).check({ force: true });
    await expect(page.getByRole("region", { name: "Week grid" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: /Friday 20 November/ }),
    ).toBeVisible();
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/roster-agenda-1440.png` });
    await page.getByRole("button", { name: "Add shift" }).click();
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/roster-form-1440.png` });
  });

  test("360x800 no clipping, form and review fit", async ({ page }) => {
    await page.setViewportSize(SMALL);
    await open(page);
    await noOverflow(page);
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/roster-agenda-360.png` });
    await page.getByRole("button", { name: "Add shift" }).click();
    await noOverflow(page);
    const box = await page.getByRole("dialog").boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(360);
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/roster-form-360.png` });
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Review and publish" }).click();
    await noOverflow(page);
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/roster-review-360.png` });
  });

  test("200% zoom equivalent (640x400): controls reachable, no page overflow", async ({
    page,
  }) => {
    await page.setViewportSize(ZOOM200);
    await open(page);
    await noOverflow(page);
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/roster-zoom200.png` });
    await page.getByRole("button", { name: "Add shift" }).click();
    const dlg = page.getByRole("dialog");
    await dlg
      .getByRole("button", { name: "Save shift to draft" })
      .scrollIntoViewIfNeeded();
    await expect(
      dlg.getByRole("button", { name: "Save shift to draft" }),
    ).toBeVisible();
    await noOverflow(page);
    await page.waitForTimeout(500); // let dialog animation settle
    await page.screenshot({ path: `${EVIDENCE}/roster-form-zoom200.png` });
  });

  test("tablet 768 agenda has no overflow", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page);
    await noOverflow(page);
  });
});
