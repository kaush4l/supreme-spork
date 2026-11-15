import { expect, test } from "@playwright/test";
import { openVenuePage, signIn, skipUnlessLive } from "../support/live";
import {
  api,
  cancelShift,
  clockedOut,
  makeShift,
  must,
  ruleValue,
  venuePath,
  watchApp,
} from "../support/staff-api";

skipUnlessLive();
// A dev server renders slowly after a write, so waits are generous (never a fixed sleep).
test.use({ actionTimeout: 15_000 });
const expectSoon = expect.configure({ timeout: 20_000 });
test.describe.configure({ mode: "serial" });

async function hourLines() {
  const v = await venuePath();
  const h = await must(api("staff", "GET", `${v}/me/hours`), "hours");
  return (h.lines as unknown[]).length;
}

test("clock in and out changes the words and a double tap makes one entry", async ({
  page,
}) => {
  const errors = watchApp(page);
  await clockedOut();
  const before = await hourLines();
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "today");
  await expectSoon(
    page.getByRole("heading", { name: "Today", level: 1 }),
  ).toBeVisible();
  await expectSoon(
    page.getByText(/^(You are not clocked in\.|Next shift:)/),
  ).toBeVisible();

  const inButton = page.getByRole("button", { name: "Clock in" });
  await inButton.dblclick();
  await expectSoon(page.getByText(/^You are clocked in/)).toBeVisible();
  await expectSoon(
    page.getByRole("button", { name: "Clock out" }),
  ).toBeVisible();
  await expectSoon(page.getByRole("button", { name: "Clock in" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Clock out" }).dblclick();
  await expectSoon(
    page.getByRole("button", { name: "Clock in" }),
  ).toBeVisible();
  await expectSoon(page.getByText(/^You are clocked in/)).toHaveCount(0);
  expect(await hourLines()).toBe(before + 1);
  errors.expectNone();
});

test("a shift planned for later shows as the next shift", async ({ page }) => {
  await clockedOut();
  const shift = await makeShift({ dayOffset: 1, hour: 22, hours: 1 });
  try {
    const id = await signIn(page, "staff");
    await openVenuePage(page, id, "today");
    // other shifts may come first, so only the shape is checked
    await expectSoon(
      page.getByText(/Next shift: .*\d:\d\d [ap]m to /),
    ).toBeVisible();
    await expectSoon(
      page.getByRole("link", { name: "All my shifts" }),
    ).toBeVisible();
  } finally {
    await cancelShift(shift.id);
  }
});

test("checklists card lists a checklist issued for a shift", async ({
  page,
}) => {
  const shift = await makeShift();
  try {
    const id = await signIn(page, "staff");
    await openVenuePage(page, id, "today");
    await expectSoon(
      page.getByRole("heading", { name: "My checklists" }),
    ).toBeVisible();
    await expectSoon(
      page.getByRole("link", { name: /Closing · / }).first(),
    ).toBeVisible();
    await expectSoon(page.getByText(/\d+ still to finish\./)).toBeVisible();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a venue that checks location says what to switch on when it cannot be read", async ({
  browser,
}) => {
  const method = (await ruleValue("clock_method")) as string;
  test.skip(
    method !== "location",
    "the demo venue clocks in from anywhere (the test does not change venue rules)",
  );
  await clockedOut();
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  try {
    const id = await signIn(page, "staff");
    await openVenuePage(page, id, "today");
    await page.getByRole("button", { name: "Clock in" }).click();
    await expectSoon(
      page.getByText(/We need your location to clock you in here/),
    ).toBeVisible();
    await expectSoon(
      page.getByRole("button", { name: "Clock in" }),
    ).toBeVisible();
  } finally {
    await clockedOut();
    await context.close();
  }
});

test("a person with nothing planned sees the empty states", async ({
  page,
}) => {
  const v = await venuePath();
  const shifts = await must(api("manager", "GET", `${v}/me/shifts`), "shifts");
  const lists = await must(
    api("manager", "GET", `${v}/workflows/me/lists`),
    "lists",
  );
  test.skip(
    shifts.length > 0 || lists.items.length > 0,
    "the manager login has shifts or lists right now",
  );
  const id = await signIn(page, "manager");
  await openVenuePage(page, id, "today");
  await expectSoon(page.getByText("You are not clocked in.")).toBeVisible();
  await expectSoon(page.getByText("Nothing to do right now.")).toBeVisible();
});

test("phone width has no sideways scroll, and an unknown venue is not found", async ({
  page,
}) => {
  const errors = watchApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "today");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const response = await page.goto(
    "/venues/00000000-0000-4000-8000-000000000000/today",
  );
  expect(response?.status()).toBe(404);
  await expectSoon(
    page.getByText(/not found|could not be found/i).first(),
  ).toBeVisible();
  errors.expectNone();
});
