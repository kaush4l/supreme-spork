import { test } from "@playwright/test";
import { signIn, skipUnlessLive } from "../support/live";
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
