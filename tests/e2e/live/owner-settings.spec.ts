import { test } from "@playwright/test";
import { signIn, skipUnlessLive, unique } from "../support/live";
import {
  demoVenue,
  errorBanner,
  expect,
  expectNoSideScroll,
  open,
  watch,
} from "./owner-support";

skipUnlessLive();

const RULE = "Minimum hours between shifts";
const field = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: `${RULE} (hours)` });
const offSwitch = (page: import("@playwright/test").Page) =>
  page.getByRole("switch", { name: `${RULE}: off` });
const save = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Save rules" });

let errs: ReturnType<typeof watch>;
test.beforeEach(({ page }) => {
  errs = watch(page);
});
test.afterEach(() => errs.expectNone());

test.describe("settings, as the owner", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  let venue: string;

  test.beforeEach(async ({ page }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
    await open(page, venue, "settings");
  });

  test("loads the roster rules and the location card", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(RULE, { exact: true }).first()).toBeVisible();
    await expect(save(page)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Where the venue is" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Set to -?\d+\.\d+, -?\d+\.\d+|Not set yet\./),
    ).toBeVisible();
  });

  test("changes a rule, sees it saved, sets it to off, and puts it back", async ({
    page,
  }) => {
    const wasOff = await offSwitch(page).isChecked();
    const was = wasOff ? "" : await field(page).inputValue();
    try {
      if (wasOff) await offSwitch(page).click();
      await field(page).fill("12");
      await save(page).click();
      await expect(page.getByText("Rules saved.")).toBeVisible();
      await open(page, venue, "settings");
      await expect(field(page)).toHaveValue("12");
      await expect(offSwitch(page)).not.toBeChecked();

      await offSwitch(page).click();
      await save(page).click();
      await expect(page.getByText("Rules saved.")).toBeVisible();
      await open(page, venue, "settings");
      await expect(offSwitch(page)).toBeChecked();
      await expect(field(page)).toBeDisabled();
    } finally {
      await open(page, venue, "settings");
      if (wasOff) {
        if (!(await offSwitch(page).isChecked())) {
          await offSwitch(page).click();
          await save(page).click();
          await expect(page.getByText("Rules saved.")).toBeVisible();
        }
      } else {
        if (await offSwitch(page).isChecked()) await offSwitch(page).click();
        await field(page).fill(was);
        await save(page).click();
        await expect(page.getByText("Rules saved.")).toBeVisible();
        await open(page, venue, "settings");
        await expect(field(page)).toHaveValue(was);
      }
    }
  });

  test("refuses a value outside the limits and a non-number, with a plain message", async ({
    page,
  }) => {
    const wasOff = await offSwitch(page).isChecked();
    const was = wasOff ? "" : await field(page).inputValue();
    if (wasOff) await offSwitch(page).click();

    await field(page).fill("99"); // the limit is 1 to 24
    await save(page).click();
    await expect(errorBanner(page).first()).toBeVisible();
    await expect(errorBanner(page).first()).not.toContainText(
      /\b(500|undefined|exception|traceback)\b/i,
    );
    await expect(page.getByText("Rules saved.")).toHaveCount(0);

    await field(page).fill("abc");
    await save(page).click();
    await expect(errorBanner(page).first()).toContainText(
      `Check the number for: ${RULE}`,
    );

    await open(page, venue, "settings"); // nothing was saved
    if (wasOff) await expect(offSwitch(page)).toBeChecked();
    else await expect(field(page)).toHaveValue(was);
  });

  test("sets the clock-in location from the browser, then puts the old one back", async ({
    page,
    context,
  }) => {
    const text = await page
      .getByText(/Set to -?\d+\.\d+, -?\d+\.\d+|Not set yet\./)
      .innerText();
    const prior = text.match(/(-?\d+\.\d+), (-?\d+\.\d+)/);
    // With no permission the browser refuses and the page says so in plain words.
    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(errorBanner(page).first()).toContainText(
      "We could not read your location",
    );

    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -33.8, longitude: 151.1 });
    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(page.getByText("Location saved.")).toBeVisible();
    await expect(page.getByText("Set to -33.80000, 151.10000")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Set to -33.80000, 151.10000")).toBeVisible();

    if (prior) {
      await context.setGeolocation({
        latitude: Number(prior[1]),
        longitude: Number(prior[2]),
      });
      await page
        .getByRole("button", { name: "Use my current location" })
        .click();
      await expect(
        page.getByText(`Set to ${prior[1]}, ${prior[2]}`),
      ).toBeVisible();
    }
  });

  test("works at phone width with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, venue, "settings");
    await expect(save(page)).toBeVisible();
    await expectNoSideScroll(page);
  });

  test("an unknown venue or a bad id shows not-found", async ({ page }) => {
    const unknown = await page.goto(
      "/venues/00000000-0000-4000-8000-000000000000/settings",
    );
    expect(unknown?.status()).toBe(404);
    const bad = await page.goto("/venues/not-a-uuid/settings");
    expect(bad?.status()).toBe(404);
  });
});

const WAGES = "Wages target (%)";
const wages = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: WAGES });
const saveVenue = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Save venue settings" });

test.describe("venue, hours and holidays, as the owner", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  let venue: string;

  test.beforeEach(async ({ page }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
    await open(page, venue, "settings");
  });

  test("shows the three cards with real data", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Venue", level: 3, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Venue name" })).toHaveValue(
      /\(demo\)/,
    );
    await expect(page.getByRole("textbox", { name: "Time zone" })).toHaveValue(
      /\w+\/\w+/,
    );
    await expect(wages(page)).toHaveValue(/^\d+(\.\d+)?$/);
    await expect(
      page.getByRole("heading", { name: "Opening hours" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Monday opens" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Public holidays" }),
    ).toBeVisible();
  });

  test("saving with nothing changed says so; a bad number is refused", async ({
    page,
  }) => {
    await saveVenue(page).click();
    await expect(page.getByText("Nothing changed.")).toBeVisible();
    const was = await wages(page).inputValue();
    await wages(page).fill("abc");
    await saveVenue(page).click();
    await expect(errorBanner(page).first()).toContainText(
      `Check the number for: Wages target`,
    );
    await wages(page).fill("101");
    await saveVenue(page).click();
    await expect(errorBanner(page).first()).toBeVisible();
    await open(page, venue, "settings");
    await expect(wages(page)).toHaveValue(was);
  });

  test("changes the wages target with a double click, then puts it back", async ({
    page,
  }) => {
    const was = await wages(page).inputValue();
    const other = Number(was) === 31 ? "32" : "31";
    try {
      await wages(page).fill(other);
      await saveVenue(page).dblclick();
      await expect(page.getByText("Venue settings saved.")).toBeVisible();
      await open(page, venue, "settings");
      await expect(wages(page)).toHaveValue(other);
    } finally {
      await open(page, venue, "settings");
      await wages(page).fill(was);
      await saveVenue(page).click();
      await expect(page.getByText("Venue settings saved.")).toBeVisible();
      await open(page, venue, "settings");
      await expect(wages(page)).toHaveValue(was);
    }
  });

  test("hours: bad times are refused; a set day is changed and put back", async ({
    page,
  }) => {
    const opens = page.getByRole("textbox", { name: "Tuesday opens" });
    const closes = page.getByRole("textbox", { name: "Tuesday closes" });
    const saveHours = page.getByRole("button", { name: "Save opening hours" });
    await saveHours.click();
    await expect(page.getByText("Nothing changed.")).toBeVisible();
    await opens.fill("9");
    await closes.fill("17:00");
    await saveHours.click();
    await expect(errorBanner(page).first()).toContainText("Tuesday");
    await open(page, venue, "settings");

    // Opening hours cannot be put back to "not set", so only a day that is already set is written.
    const was = {
      opens: await opens.inputValue(),
      closes: await closes.inputValue(),
    };
    if (!was.opens || !was.closes) return;
    try {
      await opens.fill("17:00");
      await closes.fill("01:00");
      await saveHours.click();
      await expect(page.getByText("Opening hours saved.")).toBeVisible();
      await open(page, venue, "settings");
      await expect(
        page.getByText(/closes 1:00 am the next day/).first(),
      ).toBeVisible();
    } finally {
      await open(page, venue, "settings");
      await opens.fill(was.opens);
      await closes.fill(was.closes);
      await saveHours.click();
      await expect(page.getByText("Opening hours saved.")).toBeVisible();
    }
  });

  test("adds a far-future holiday once, renames it, and removes it", async ({
    page,
  }) => {
    test.setTimeout(300_000); // a slow dev server needs a few reloads here
    const day = `2099-12-${String(1 + (Date.now() % 28)).padStart(2, "0")}`;
    const name = unique("Holiday");
    const renamed = `${name} b`;
    const date = page.getByRole("textbox", { name: "Holiday date" });
    const label = page.getByRole("textbox", { name: "Holiday name" });
    const saveDay = page.getByRole("button", { name: "Save holiday" });
    await page.getByRole("textbox", { name: "Year" }).fill("2099");
    await page.getByRole("button", { name: "Show year" }).click();
    await expect(page).toHaveURL(/year=2099/);
    try {
      await date.fill(day);
      await label.fill(name);
      await saveDay.dblclick();
      await expect(page.getByText("Holiday saved.")).toBeVisible();
      await expect(page.getByText(name, { exact: true })).toHaveCount(1);

      await page.getByRole("button", { name: `Rename ${name}` }).click();
      await label.fill(renamed);
      await saveDay.click();
      await expect(page.getByText(renamed, { exact: true })).toBeVisible();
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      await page
        .getByRole("button", { name: `Remove ${renamed}`, exact: true })
        .click();
      await expect(page.getByText("Holiday removed.")).toBeVisible();
      await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);
    } finally {
      // Whatever the body reached, leave no holiday of ours behind.
      for (const n of [renamed, name]) {
        const one = page.getByRole("button", {
          name: `Remove ${n}`,
          exact: true,
        });
        if (await one.count()) {
          await one.click();
          await expect(one).toHaveCount(0);
        }
      }
    }
  });

  test("the empty Bondi venue says no holidays and shows hours as not set", async ({
    page,
  }) => {
    await page.goto("/");
    const href = await page
      .locator('a[href^="/venues/"]')
      .filter({ hasText: /Bondi/ })
      .first()
      .getAttribute("href");
    const bondi = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1] as string;
    await open(page, bondi, "settings?year=2099");
    await expect(
      page.getByText("No public holidays are set for 2099."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Opening hours" }),
    ).toBeVisible();
  });

  test("works at phone width with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, venue, "settings");
    await expect(saveVenue(page)).toBeVisible();
    await expectNoSideScroll(page);
  });
});

test.describe("venue, hours and holidays, read only", () => {
  test.describe.configure({ timeout: 120_000 });
  test("a manager sees the cards and targets with no edit controls", async ({
    page,
  }) => {
    await signIn(page, "manager");
    const venue = await demoVenue(page);
    await open(page, venue, "settings");
    await expect(
      page.getByRole("heading", { name: "Venue", level: 3, exact: true }),
    ).toBeVisible();
    await expect(wages(page)).toBeDisabled();
    await expect(saveVenue(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save opening hours" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save holiday" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Monday opens" }),
    ).toHaveCount(0);
  });
});

test.describe("settings, as other roles", () => {
  test.describe.configure({ timeout: 120_000 });
  test("a manager has no Settings link and sees the rules read-only", async ({
    page,
  }) => {
    await signIn(page, "manager");
    const venue = await demoVenue(page);
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Settings" }),
    ).toHaveCount(0);
    await open(page, venue, "settings");
    await expect(
      page.getByText("Only the owner and partners can change these."),
    ).toBeVisible();
    await expect(save(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Use my current location" }),
    ).toHaveCount(0);
    await expect(offSwitch(page)).toBeDisabled();
  });

  test("a staff member gets no rules and no save button", async ({ page }) => {
    await signIn(page, "staff");
    const venue = await demoVenue(page);
    await open(page, venue, "settings");
    await expect(save(page)).toHaveCount(0);
    await expect(page.getByText(RULE, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });
});
