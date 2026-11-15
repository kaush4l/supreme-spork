import { expect, test } from "@playwright/test";
import { signIn, skipUnlessLive, watchForBrowserErrors } from "../support/live";
import { api, must, venuePath } from "../support/staff-api";
import {
  addDaysIso,
  addShift,
  farWeek,
  fillShift,
  nextWeekMonday,
  noSideScroll,
  openRoster,
  pickerDate,
  pickerTime,
  shiftCard,
  shownTime,
} from "./manager-helpers";

skipUnlessLive();

const DEMO_WEEK = "2026-11-09";
const PERSON = "Priya Nair"; // the demo staff login (Bartender)
const POSITION = "Bartender";
const span = (a: string, b: string) => `${shownTime(a)} to ${shownTime(b)}`;

test.describe("manager roster", () => {
  test("the grid draws for the demo week with seven days and the seen card", async ({
    page,
  }) => {
    const errors = watchForBrowserErrors(page);
    const v = await signIn(page, "manager");
    await openRoster(page, v, DEMO_WEEK);
    await expect(page.getByText("Mon, 9 Nov to Sun, 15 Nov")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(7);
    await expect(
      page.getByRole("button", { name: "Add", exact: true }),
    ).toHaveCount(7);
    await expect(
      page.getByRole("heading", { name: "Who has seen it" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add a shift" }),
    ).toBeVisible();
    // The demo week has shifts, so it is not offered for copying.
    await expect(
      page.getByRole("button", { name: "Copy last week" }),
    ).toHaveCount(0);
    await expect(page.getByText(/Nothing is rostered/)).toHaveCount(0);
    errors.expectNone();
  });

  test("no week in the address opens the current week", async ({ page }) => {
    const v = await signIn(page, "manager");
    await openRoster(page, v);
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(7);
    await expect(page.getByText(/ to .*/).first()).toBeVisible();
  });

  test("no week in the address opens the week the backend names", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const grid = await must(
      api("manager", "GET", `${await venuePath()}/roster`),
      "roster",
    );
    const day = (iso: string, plus: number) => {
      const d = new Date(`${iso}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + plus);
      return new Intl.DateTimeFormat("en-AU", {
        timeZone: "UTC",
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(d);
    };
    await openRoster(page, v);
    await expect(
      page.getByText(
        `${day(grid.week_start, 0)} to ${day(grid.week_start, 6)}`,
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Next week" })).toHaveAttribute(
      "href",
      /week=/,
    );
  });

  test("an empty week shows the empty state, copy offered, publish disabled", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    await openRoster(page, v, farWeek());
    await expect(
      page.getByText(
        "Nothing is rostered this week yet. Add a shift or copy last week.",
      ),
    ).toBeVisible();
    await expect(page.getByText("No shifts", { exact: true })).toHaveCount(7);
    await expect(
      page.getByRole("button", { name: "Copy last week" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
    await expect(
      page.getByText(
        "This week has not been published, so nobody has seen it.",
      ),
    ).toBeVisible();
  });

  test("previous and next week move by seven days", async ({ page }) => {
    const v = await signIn(page, "manager");
    await openRoster(page, v, DEMO_WEEK);
    await page.getByRole("link", { name: "Next week" }).click();
    await expect(page).toHaveURL(/week=2026-11-16/);
    await expect(page.getByText("Mon, 16 Nov to Sun, 22 Nov")).toBeVisible();
    await page.getByRole("link", { name: "Previous week" }).click();
    await expect(page).toHaveURL(/week=2026-11-09/);
    await page.getByRole("link", { name: "Previous week" }).click();
    await expect(page).toHaveURL(/week=2026-11-02/);
    await expect(page.getByText("Mon, 2 Nov to Sun, 8 Nov")).toBeVisible();
    // A date that is not a Monday falls back to the current week rather than breaking.
    await openRoster(page, v, "2026-11-10");
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(7);
  });

  test("add a shift for a person: it shows, and the picker round-trips the typed times", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    const day = addDaysIso(week, 2);
    await openRoster(page, v, week);
    await addShift(page, {
      position: POSITION,
      who: PERSON,
      startDate: day,
      startTime: "10:30",
      endDate: day,
      endTime: "15:45",
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const card = shiftCard(page, span("10:30", "15:45"));
    await expect(card).toBeVisible();
    await expect(card).toContainText(`${POSITION} · ${PERSON}`);
    await expect(card).toContainText("Not published");
    // It sits under Wednesday of that week.
    await expect(
      page.getByText("Not published yet:", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByText("This week is not published yet."),
    ).toBeVisible();
    // Open it again: the dialog holds exactly what was typed, on the same day.
    await card.getByRole("button", { name: "Edit" }).click();
    const d = page.getByRole("dialog");
    const inputs = d.locator('input[placeholder="Select a date"]');
    await expect(inputs.nth(0)).toHaveValue(pickerDate(day));
    await expect(inputs.nth(1)).toHaveValue(pickerDate(day));
    await expect(d.getByLabel("Starts (venue time) time")).toHaveValue(
      pickerTime("10:30"),
    );
    await expect(d.getByLabel("Ends (venue time) time")).toHaveValue(
      pickerTime("15:45"),
    );
  });

  test("times round-trip across midnight and across the daylight-saving change", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    // Sydney clocks go back on Sunday 2027-04-04; the week of 2027-03-29 contains it.
    const week = "2027-03-29";
    const sunday = "2027-04-04";
    await openRoster(page, v, week);
    await addShift(page, {
      position: POSITION,
      startDate: sunday,
      startTime: "22:13",
      endDate: addDaysIso(sunday, 1),
      endTime: "03:41",
    });
    const card = shiftCard(page, span("22:13", "03:41"));
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Edit" }).click();
    const d = page.getByRole("dialog");
    const dates = d.locator('input[placeholder="Select a date"]');
    await expect(dates.nth(0)).toHaveValue(pickerDate(sunday));
    await expect(dates.nth(1)).toHaveValue(pickerDate(addDaysIso(sunday, 1)));
    await expect(d.getByLabel("Starts (venue time) time")).toHaveValue(
      pickerTime("22:13"),
    );
    await expect(d.getByLabel("Ends (venue time) time")).toHaveValue(
      pickerTime("03:41"),
    );
    // Clean up so reruns start from the same place.
    await d.getByRole("button", { name: "Cancel shift" }).click();
    await d.getByRole("button", { name: "Yes, cancel this shift" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(shiftCard(page, span("22:13", "03:41"))).toHaveCount(0);
  });

  test("an open shift with no person shows as Open", async ({ page }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    const day = week;
    await openRoster(page, v, week);
    await addShift(page, {
      position: POSITION,
      startDate: day,
      startTime: "08:20",
      endDate: day,
      endTime: "12:20",
    });
    const card = shiftCard(page, span("08:20", "12:20"));
    await expect(card).toContainText(`${POSITION} · Open`, { timeout: 20_000 });
  });

  test("a shift that ends before it starts is refused in plain words", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    await openRoster(page, v, week);
    const d = await addShift(page, {
      position: POSITION,
      startDate: week,
      startTime: "17:00",
      endDate: week,
      endTime: "09:00",
    });
    await expect(
      d.getByText("The shift must end after it starts."),
    ).toBeVisible();
    await expect(d).toBeVisible();
    await d.getByRole("button", { name: "Close" }).last().click();
    await expect(page.getByText("No shifts", { exact: true })).toHaveCount(7);
  });

  test("a shift longer than the limit is refused", async ({ page }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    await openRoster(page, v, week);
    const d = await addShift(page, {
      position: POSITION,
      startDate: week,
      startTime: "06:00",
      endDate: addDaysIso(week, 3),
      endTime: "06:00",
    });
    await expect(
      d.getByText(/A shift can be at most \d+ hours\./),
    ).toBeVisible();
  });

  test("saving with no position asks for one and sends nothing", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    await openRoster(page, v, week);
    await page.getByRole("button", { name: "Add a shift" }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Add shift" }).click();
    await expect(d.getByText("Choose a position.")).toBeVisible();
    await d.getByRole("button", { name: "Close" }).last().click();
    await expect(page.getByText("No shifts", { exact: true })).toHaveCount(7);
  });

  test("two overlapping shifts for one person are both kept (the backend only warns)", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    await openRoster(page, v, week);
    await addShift(page, {
      position: POSITION,
      who: PERSON,
      startDate: week,
      startTime: "09:00",
      endDate: week,
      endTime: "17:00",
    });
    await expect(shiftCard(page, span("09:00", "17:00"))).toBeVisible();
    const d = await addShift(page, {
      position: POSITION,
      who: PERSON,
      startDate: week,
      startTime: "12:00",
      endDate: week,
      endTime: "20:00",
    });
    // The backend has no overlap refusal (only rest, hours, availability and certificate checks, which warn).
    await expect(d).toHaveCount(0);
    await expect(shiftCard(page, span("09:00", "17:00"))).toBeVisible();
    await expect(shiftCard(page, span("12:00", "20:00"))).toBeVisible();
  });

  test("change a shift: move its time and give it to someone else, then make it open", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    await openRoster(page, v, week);
    await addShift(page, {
      position: POSITION,
      who: PERSON,
      startDate: week,
      startTime: "10:00",
      endDate: week,
      endTime: "14:00",
    });
    await shiftCard(page, span("10:00", "14:00"))
      .getByRole("button", { name: "Edit" })
      .click();
    await fillShift(page, { startTime: "11:10", endTime: "15:20" });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(shiftCard(page, span("10:00", "14:00"))).toHaveCount(0);
    const moved = shiftCard(page, span("11:10", "15:20"));
    await expect(moved).toContainText(`${POSITION} · ${PERSON}`);
    // Move it to the next day by changing the dates.
    await moved.getByRole("button", { name: "Edit" }).click();
    const next = addDaysIso(week, 1);
    await fillShift(page, { startDate: next, endDate: next });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const day2 = page
      .getByRole("heading", { level: 3 })
      .nth(1)
      .locator("xpath=ancestor::div[.//button[normalize-space()='Add']][2]");
    await expect(day2).toContainText(span("11:10", "15:20"));
    // Make it open.
    await shiftCard(page, span("11:10", "15:20"))
      .getByRole("button", { name: "Edit" })
      .click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: /^Who works it/ }).click();
    await page.getByRole("option", { name: "Open (nobody yet)" }).click();
    await d.getByRole("button", { name: "Save" }).click();
    await expect(shiftCard(page, span("11:10", "15:20"))).toContainText(
      `${POSITION} · Open`,
    );
  });

  test("changing a shift so it ends before it starts is refused and the shift stays", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    await openRoster(page, v, week);
    await addShift(page, {
      position: POSITION,
      startDate: week,
      startTime: "10:00",
      endDate: week,
      endTime: "14:00",
    });
    await shiftCard(page, span("10:00", "14:00"))
      .getByRole("button", { name: "Edit" })
      .click();
    await fillShift(page, { endTime: "09:00" });
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Save" }).click();
    await expect(
      d.getByText("The shift must end after it starts."),
    ).toBeVisible();
    await d.getByRole("button", { name: "Close" }).last().click();
    await expect(shiftCard(page, span("10:00", "14:00"))).toBeVisible();
  });

  test("cancel a shift asks to confirm, then removes it", async ({ page }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    await openRoster(page, v, week);
    await addShift(page, {
      position: POSITION,
      who: PERSON,
      startDate: week,
      startTime: "13:00",
      endDate: week,
      endTime: "18:00",
    });
    await shiftCard(page, span("13:00", "18:00"))
      .getByRole("button", { name: "Edit" })
      .click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Cancel shift" }).click();
    // One more click is needed; closing now keeps the shift.
    await expect(
      d.getByRole("button", { name: "Yes, cancel this shift" }),
    ).toBeVisible();
    await d.getByRole("button", { name: "Close" }).last().click();
    await expect(shiftCard(page, span("13:00", "18:00"))).toBeVisible();
    await shiftCard(page, span("13:00", "18:00"))
      .getByRole("button", { name: "Edit" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel shift" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Yes, cancel this shift" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(shiftCard(page, span("13:00", "18:00"))).toHaveCount(0);
    await expect(page.getByText("No shifts", { exact: true })).toHaveCount(7);
  });

  test("copy last week: refused when the week before is empty, works when it has shifts, then not offered", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    const before = addDaysIso(week, -7);
    // Both empty: the backend says there is nothing to copy.
    await openRoster(page, v, week);
    await page.getByRole("button", { name: "Copy last week" }).click();
    await expect(
      page.getByText("The week before has no shifts to copy."),
    ).toBeVisible();
    await expect(page.getByText("No shifts", { exact: true })).toHaveCount(7);
    // Give the week before a shift and copy it.
    await openRoster(page, v, before);
    await addShift(page, {
      position: POSITION,
      who: PERSON,
      startDate: addDaysIso(before, 1),
      startTime: "09:25",
      endDate: addDaysIso(before, 1),
      endTime: "13:35",
    });
    await expect(shiftCard(page, span("09:25", "13:35"))).toBeVisible();
    await openRoster(page, v, week);
    await page.getByRole("button", { name: "Copy last week" }).click();
    await expect(
      page.getByText("Last week was copied into this one."),
    ).toBeVisible();
    await expect(shiftCard(page, span("09:25", "13:35"))).toContainText(
      `${POSITION} · ${PERSON}`,
    );
    // The week now has shifts, so copying is no longer offered.
    await expect(
      page.getByRole("button", { name: "Copy last week" }),
    ).toHaveCount(0);
    await expect(page.getByText(/Nothing is rostered/)).toHaveCount(0);
  });

  test("publish: first publish works, a second says nothing new, receipts list who has not seen it", async ({
    page,
  }) => {
    const v = await signIn(page, "manager");
    const week = farWeek();
    await openRoster(page, v, week);
    await addShift(page, {
      position: POSITION,
      who: PERSON,
      startDate: week,
      startTime: "09:00",
      endDate: week,
      endTime: "12:00",
    });
    await expect(shiftCard(page, span("09:00", "12:00"))).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    const sent = page.getByText("Sent for approval");
    const done = page.getByText(/Published as version \d+\./);
    await expect(sent.or(done)).toBeVisible();
    if (await sent.isVisible()) {
      // The owner asked for a second person to approve publishing: nothing was published.
      await expect(
        page.getByRole("link", { name: "See change requests" }),
      ).toHaveAttribute("href", new RegExp(`/venues/${v}/changes$`));
      test.info().annotations.push({
        type: "note",
        description:
          "publish needs approval at this venue; the published-state checks were skipped",
      });
      return;
    }
    await expect(shiftCard(page, span("09:00", "12:00"))).toContainText(
      "Published",
    );
    await expect(shiftCard(page, span("09:00", "12:00"))).not.toContainText(
      "Not published",
    );
    await expect(page.getByText("This week is not published yet.")).toHaveCount(
      0,
    );
    // Seen receipts: the person has a login but has not opened it yet.
    await expect(page.getByText(/Version \d+, published/)).toBeVisible();
    await expect(page.getByText("Not seen yet")).toBeVisible();
    await expect(page.getByText(PERSON).last()).toBeVisible();
    // Publishing again with nothing new changes nothing.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Nothing new to publish")).toBeVisible();
    // A new shift is flagged as not published, and publishing it moves the version on.
    await addShift(page, {
      position: POSITION,
      startDate: addDaysIso(week, 1),
      startTime: "10:00",
      endDate: addDaysIso(week, 1),
      endTime: "14:00",
    });
    await expect(shiftCard(page, span("10:00", "14:00"))).toContainText(
      "Not published",
    );
    await expect(page.getByText("Not published yet: 1 added.")).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/Published as version \d+\./)).toBeVisible();
    await expect(
      page.getByText("Not published yet:", { exact: false }),
    ).toHaveCount(0);
  });

  test("staff see a published shift in My shifts, an unpublished one is hidden, and they cannot open the roster", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const v = await signIn(page, "manager");
    const week = nextWeekMonday();
    const day = addDaysIso(week, 1);
    // Odd minutes so this run's shifts are easy to tell from anything else on the week.
    const m = () => String(10 + Math.floor(Math.random() * 40));
    const pubStart = `04:${m()}`;
    const pubEnd = `06:${m()}`;
    const draftStart = `07:${m()}`;
    const draftEnd = `08:${m()}`;
    const pubSpan = span(pubStart, pubEnd);
    const draftSpan = span(draftStart, draftEnd);

    const staffCtx = await browser.newContext();
    const staff = await staffCtx.newPage();
    const sv = await signIn(staff, "staff");
    try {
      expect(sv).toBe(v);
      await openRoster(page, v, week);
      await addShift(page, {
        position: POSITION,
        who: PERSON,
        startDate: day,
        startTime: pubStart,
        endDate: day,
        endTime: pubEnd,
      });
      await expect(shiftCard(page, pubSpan)).toBeVisible();
      // Not published yet: staff do not see it.
      await staff.goto(`/venues/${v}/shifts`);
      await expect(
        staff.getByRole("heading", { name: "My shifts" }),
      ).toBeVisible();
      await expect(staff.getByText(pubSpan)).toHaveCount(0);
      // Publish; now staff see it.
      await page.getByRole("button", { name: "Publish" }).click();
      const sent = page.getByText("Sent for approval");
      const done = page.getByText(
        /Published as version \d+\.|Nothing new to publish/,
      );
      await expect(sent.or(done)).toBeVisible();
      test.skip(
        await sent.isVisible(),
        "publishing needs approval at this venue",
      );
      await staff.reload();
      await expect(staff.getByText(pubSpan)).toBeVisible();
      // A second shift added after publishing stays hidden from staff until it is published.
      await addShift(page, {
        position: POSITION,
        who: PERSON,
        startDate: day,
        startTime: draftStart,
        endDate: day,
        endTime: draftEnd,
      });
      await expect(shiftCard(page, draftSpan)).toContainText("Not published");
      await staff.reload();
      await expect(staff.getByText(pubSpan)).toBeVisible();
      await expect(staff.getByText(draftSpan)).toHaveCount(0);
      // Staff cannot open the manager roster or board.
      // (A page with a loading state streams, so its status stays 200: check the words.)
      await staff.goto(`/venues/${v}/roster`);
      await expect(staff.getByText(/could not be found/i)).toBeVisible();
      await expect(
        staff.getByRole("button", { name: "Add a shift" }),
      ).toHaveCount(0);
      await staff.goto(`/venues/${v}/board`);
      await expect(staff.getByText(/could not be found/i)).toBeVisible();
    } finally {
      // Leave the week tidy: cancel what this run added.
      for (const s of [pubSpan, draftSpan]) {
        await openRoster(page, v, week);
        const card = shiftCard(page, s);
        if ((await card.count()) === 0) continue;
        await card.getByRole("button", { name: "Edit" }).click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel shift" })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Yes, cancel this shift" })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      await staffCtx.close();
    }
  });

  test("the roster is usable at phone width with no sideways scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const v = await signIn(page, "manager");
    await openRoster(page, v, DEMO_WEEK);
    await noSideScroll(page);
    await expect(
      page.getByRole("button", { name: "Add a shift" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add a shift" }).click();
    const d = page.getByRole("dialog");
    await expect(d.getByRole("button", { name: "Add shift" })).toBeVisible();
    const box = await d.boundingBox();
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    await noSideScroll(page);
    await d.getByRole("button", { name: "Close" }).last().click();
  });

  test("opening the shift dialog raises no CSP violation", async ({ page }) => {
    const errors = watchForBrowserErrors(page);
    const v = await signIn(page, "manager");
    await openRoster(page, v, farWeek());
    await page.getByRole("button", { name: "Add a shift" }).click();
    const d = page.getByRole("dialog");
    await expect(d.getByRole("button", { name: "Add shift" })).toBeVisible();
    await d.locator("button[role=combobox]").click();
    await page.getByRole("option").first().click();
    await d.getByRole("button", { name: "Close" }).last().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    errors.expectNone();
  });

  test("an unknown venue id shows not found", async ({ page }) => {
    await signIn(page, "manager");
    const unknown = await page.goto(
      "/venues/00000000-0000-4000-8000-000000000000/roster",
    );
    expect(unknown?.status()).toBe(404);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    const bad = await page.goto("/venues/not-a-venue/roster");
    expect(bad?.status()).toBe(404);
  });
});
