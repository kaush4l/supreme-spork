import { expect, type Page, test } from "@playwright/test";
import { openVenuePage, signIn, skipUnlessLive } from "../support/live";
import {
  api,
  leaveDecided,
  localDay,
  must,
  noticeTotals,
  PRIYA,
  staffIds,
  venuePath,
  watchApp,
} from "../support/staff-api";

skipUnlessLive();
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: "serial" });
const expectSoon = expect.configure({ timeout: 20_000 });

const typedOf = (iso: string) =>
  `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const hoursText = (h: number) =>
  `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, "")} h`;

async function openPay(page: Page, query = "") {
  const id = await signIn(page, "staff");
  await page.goto(`/venues/${id}/pay${query}`);
  await expectSoon(
    page.getByRole("heading", { name: "My pay", level: 1 }),
  ).toBeVisible();
  return id;
}

test("the default range shows hours and an estimate that says it is not a payslip", async ({
  page,
}) => {
  const errors = watchApp(page);
  await openPay(page);
  await expectSoon(
    page.getByText(
      /Estimate only: your hours times your own hourly rate\. It is not a payslip\./,
    ),
  ).toBeVisible();
  await expectSoon(page.getByText(/^Hours worked: [\d.]+ h$/)).toBeVisible();
  await expectSoon(
    page.getByText(/^Estimated total: (\$[\d,]+\.\d\d|no rate set)$/),
  ).toBeVisible();
  await expectSoon(
    page.getByRole("heading", { name: "Other dates" }),
  ).toBeVisible();
  errors.expectNone();
});

test("a custom range typed into the form shows the worked day and what the backend says it earns", async ({
  page,
}) => {
  const v = await venuePath();
  const ids = await staffIds();
  const day = localDay(-(20 + Math.floor(Math.random() * 60)));
  for (const [kind, at, brk] of [
    ["in", `${day}T09:00:00`, 0],
    ["out", `${day}T13:30:00`, 30],
  ] as const)
    await must(
      api("manager", "POST", `${v}/time-entries`, {
        staff_id: ids[PRIYA],
        kind,
        at,
        break_minutes: brk,
        note: "e2e pay test",
      }),
      "entry",
    );
  const hours = await must(
    api("staff", "GET", `${v}/me/hours?from=${day}&to=${day}`),
    "hours",
  );
  expect(hours.hours).toBeGreaterThan(0);

  await openPay(page);
  await page.getByRole("combobox", { name: "From" }).fill(typedOf(day));
  await page.getByRole("combobox", { name: "From" }).press("Tab");
  await page.getByRole("combobox", { name: "To" }).fill(typedOf(day));
  await page.getByRole("combobox", { name: "To" }).press("Tab");
  await page.getByRole("button", { name: "Show these days" }).click();
  await page.waitForURL(new RegExp(`from=${day}&to=${day}`));
  await expectSoon(
    page.getByText(`Hours worked: ${hoursText(hours.hours)}`),
  ).toBeVisible();
  await expectSoon(
    page.getByText(/In 9:00 am, out 1:30 pm, 30 min break/),
  ).toBeVisible();
  if (hours.estimated_cents !== null)
    await expectSoon(page.getByText(/^Estimated total: \$/)).toBeVisible();
});

test("a range with no worked hours says so", async ({ page }) => {
  await openPay(page, "?from=2020-01-01&to=2020-01-07");
  await expectSoon(
    page.getByText("No worked hours in these dates."),
  ).toBeVisible();
  await expectSoon(page.getByText("Hours worked: 0 h")).toBeVisible();
});

test("a range over 92 days shows the backend's sentence in a banner and no figures", async ({
  page,
}) => {
  const v = await venuePath();
  const answer = await api(
    "staff",
    "GET",
    `${v}/me/hours?from=2026-01-01&to=2026-06-01`,
  );
  expect(answer.status).toBe(422);
  await openPay(page, "?from=2026-01-01&to=2026-06-01");
  await expectSoon(page.getByText(answer.json.error.message)).toBeVisible();
  await expect(page.getByText(/^Hours worked:/)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Other dates" }),
  ).toBeVisible();
});

test("a start date after the end date is refused with a banner", async ({
  page,
}) => {
  const v = await venuePath();
  const answer = await api(
    "staff",
    "GET",
    `${v}/me/hours?from=2026-05-01&to=2026-04-01`,
  );
  expect(answer.status).toBe(422);
  await openPay(page, "?from=2026-05-01&to=2026-04-01");
  await expectSoon(page.getByText(answer.json.error.message)).toBeVisible();
  await expect(page.getByText(/^Hours worked:/)).toHaveCount(0);
});

test("the pay page shows nobody else's name or pay", async ({ page }) => {
  const ids = await staffIds();
  await openPay(page);
  await expectSoon(page.getByText(/^Hours worked:/)).toBeVisible();
  const body = await page.locator("body").innerText();
  const main = body.slice(body.indexOf("My pay"));
  for (const name of Object.keys(ids).filter((n) => n !== PRIYA))
    expect(main).not.toContain(name);
  expect(main).not.toMatch(/hourly_cost|labour cost|everyone/i);
});

test("the Show these days button waits for both dates", async ({ page }) => {
  await openPay(page, "?from=2020-01-01&to=2020-01-07");
  await page.getByRole("combobox", { name: "From" }).fill("");
  await page.getByRole("combobox", { name: "From" }).press("Tab");
  await expect(
    page.getByRole("button", { name: "Show these days" }),
  ).toBeDisabled();
});

test("pay: phone width has no sideways scroll, and an unknown venue is not found", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPay(page);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const response = await page.goto(
    "/venues/00000000-0000-4000-8000-000000000000/pay",
  );
  expect(response?.status()).toBe(404);
});

test("a new notice shows with the unread count and Mark read clears it", async ({
  page,
}) => {
  const errors = watchApp(page);
  await leaveDecided(false, "Not that week");
  const before = await noticeTotals();
  expect(before.unread).toBeGreaterThan(0);
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "notices");
  await expectSoon(
    page.getByRole("heading", { name: "Notices", level: 1 }),
  ).toBeVisible();
  await expectSoon(
    page.getByText(`${before.unread} new`, { exact: true }),
  ).toBeVisible();
  const fresh = page.getByText("New: Your leave request was rejected").first();
  await expectSoon(fresh).toBeVisible();
  await expectSoon(
    page
      .getByText(/^\d+ \w+ \d+:\d\d [ap]m$|\d{1,2} \w{3} \d{1,2}:\d\d/)
      .first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mark read" }).first().click();
  await expectSoon
    .poll(async () => (await noticeTotals()).unread)
    .toBe(before.unread - 1);
  if (before.unread - 1 > 0)
    await expectSoon(
      page.getByText(`${before.unread - 1} new`, { exact: true }),
    ).toBeVisible();
  else await expectSoon(page.getByText(/\d+ new/)).toHaveCount(0);
  errors.expectNone();
});

test("more than one page is split with Older and Newer links", async ({
  page,
}) => {
  test.setTimeout(240_000);
  let { total } = await noticeTotals();
  while (total <= 20) {
    const batch = Math.min(5, 21 - total);
    await Promise.all(Array.from({ length: batch }, () => leaveDecided(false)));
    total = (await noticeTotals()).total;
  }
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "notices");
  await expectSoon(page.getByRole("link", { name: "Older" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Newer" })).toHaveCount(0);
  await expect(
    page
      .getByRole("button", { name: "Mark read" })
      .or(page.getByText(/^Your /))
      .first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Older" }).click();
  await page.waitForURL(/offset=20/);
  await expectSoon(page.getByRole("link", { name: "Newer" })).toBeVisible();
  await page.getByRole("link", { name: "Newer" }).click();
  await page.waitForURL((u) => !u.search.includes("offset=20"));
  await expectSoon(page.getByRole("link", { name: "Older" })).toBeVisible();
});

test("asking for a page past the end says there are no more", async ({
  page,
}) => {
  const id = await signIn(page, "staff");
  await page.goto(`/venues/${id}/notices?offset=100000`);
  await expectSoon(page.getByText("No more notices.")).toBeVisible();
  await expectSoon(page.getByRole("link", { name: "Newer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Older" })).toHaveCount(0);
});

test("a person with no notices sees the empty sentence", async ({ page }) => {
  const v = await venuePath();
  const n = await must(
    api("manager", "GET", `${v}/workflows/notifications?limit=1`),
    "notices",
  );
  test.skip(n.total > 0, "the manager login already has notices");
  const id = await signIn(page, "manager");
  await openVenuePage(page, id, "notices");
  await expectSoon(page.getByText("You have no notices.")).toBeVisible();
});

test("notices: phone width has no sideways scroll, and an unknown venue is not found", async ({
  page,
}) => {
  const errors = watchApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "notices");
  await expectSoon(
    page.getByRole("heading", { name: "Notices", level: 1 }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const response = await page.goto(
    "/venues/00000000-0000-4000-8000-000000000000/notices",
  );
  expect(response?.status()).toBe(404);
  errors.expectNone();
});
