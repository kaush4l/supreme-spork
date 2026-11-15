import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";
import { watchCsp } from "./manager-ops-helpers";

skipUnlessLive();
test.setTimeout(240_000);
test.use({ actionTimeout: 30_000 });
const slow = expect.configure({ timeout: 25_000 });

const NOT_FOUND = /could not be found|not found/i;

async function as(browser: Browser, role: Role) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const venue = await signIn(page, role);
  return { context, page, venue };
}

/** A day in 2024-2025 that an earlier run is unlikely to have used. */
function pastDay(): string {
  return new Date(Date.UTC(2024, 0, 1 + Math.floor(Math.random() * 700)))
    .toISOString()
    .slice(0, 10);
}

async function noSideScroll(page: Page) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(wide, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

async function showRange(page: Page, from: string, to: string) {
  await page.getByLabel("From", { exact: true }).fill(from);
  await page.getByLabel("To", { exact: true }).fill(to);
  await page.getByRole("button", { name: "Show", exact: true }).click();
}

async function addEntry(
  page: Page,
  f: {
    day: string;
    time: string;
    kind: "Clock in" | "Clock out";
    note: string;
    brk?: string;
  },
) {
  await page.getByRole("button", { name: /^Person/ }).click();
  await page.getByRole("option").first().click();
  if (f.kind === "Clock out") {
    await page.getByRole("combobox", { name: /^Clock/ }).click();
    await page.getByRole("option", { name: "Clock out" }).click();
    await page.getByLabel("Break (minutes)").fill(f.brk ?? "0");
  }
  await page.getByLabel("Date", { exact: true }).fill(f.day);
  await page.getByLabel("Time", { exact: true }).fill(f.time);
  if (f.note) await page.getByLabel(/Why are you adding this/).fill(f.note);
  await page.getByRole("button", { name: "Add entry" }).click();
}

test("the default range opens with the form, the download link and either lines or the empty sentence", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "timesheet");
  await slow(
    mgr.page.getByRole("heading", { name: "Timesheet", level: 1 }),
  ).toBeVisible();
  await slow(mgr.page.getByLabel("From", { exact: true })).toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await slow(mgr.page.getByLabel("To", { exact: true })).toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await slow(
    mgr.page.getByRole("link", { name: /Download as a spreadsheet/ }),
  ).toBeVisible();
  await slow(
    mgr.page
      .getByText(/^Total /)
      .first()
      .or(mgr.page.getByText(/Nobody clocked in between/)),
  ).toBeVisible();
  watch.expectNone();
  await mgr.context.close();
});

test("a missing entry needs a note, then a clock in and out appear as a line", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const day = pastDay();
  await openVenuePage(mgr.page, mgr.venue, "timesheet");

  // note is required
  await addEntry(mgr.page, { day, time: "09:00", kind: "Clock in", note: "" });
  await slow(mgr.page.getByText("Say why you are adding this.")).toBeVisible();
  // bad date / time words
  await mgr.page
    .getByLabel(/Why are you adding this/)
    .fill(unique("forgot in"));
  await mgr.page.getByLabel("Time", { exact: true }).fill("9am");
  await mgr.page.getByRole("button", { name: "Add entry" }).click();
  await slow(mgr.page.getByText(/Write the date like/)).toBeVisible();
  await mgr.page.getByLabel("Time", { exact: true }).fill("09:00");
  await mgr.page.getByRole("button", { name: "Add entry" }).click();
  await slow(mgr.page.getByText("Entry added.")).toBeVisible();

  // now the clock out, venue-local 17:30 with a 30 minute break
  await mgr.page.getByRole("combobox", { name: /^Clock/ }).click();
  await mgr.page.getByRole("option", { name: "Clock out" }).click();
  await mgr.page.getByLabel("Time", { exact: true }).fill("17:30");
  await mgr.page.getByLabel("Break (minutes)").fill("30");
  await mgr.page
    .getByLabel(/Why are you adding this/)
    .fill(unique("forgot out"));
  await mgr.page.getByRole("button", { name: "Add entry" }).click();
  await slow(mgr.page.getByText("Entry added.")).toBeVisible();

  await mgr.page.waitForLoadState("load");
  await slow(async () => {
    await showRange(mgr.page, day, day);
    await slow(mgr.page).toHaveURL(new RegExp(`from=${day}&to=${day}`), {
      timeout: 3000,
    });
  }).toPass({ timeout: 30_000 });
  const line = mgr.page.getByText(
    `${day}: in 9:00 am, out 5:30 pm, break 30 min`,
  );
  await slow(line).toBeVisible();
  await mgr.context.close();
});

test("a line can be corrected with a note: the break changes on the line", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const day = pastDay();
  await openVenuePage(mgr.page, mgr.venue, "timesheet");
  await addEntry(mgr.page, {
    day,
    time: "09:00",
    kind: "Clock in",
    note: unique("in"),
  });
  await slow(mgr.page.getByText("Entry added.")).toBeVisible();
  await addEntry(mgr.page, {
    day,
    time: "17:00",
    kind: "Clock out",
    brk: "0",
    note: unique("out"),
  });
  await slow(mgr.page.getByText("Entry added.").first()).toBeVisible();
  await mgr.page.waitForLoadState("load");
  await slow(async () => {
    await showRange(mgr.page, day, day);
    await slow(mgr.page).toHaveURL(new RegExp(`from=${day}&to=${day}`), {
      timeout: 3000,
    });
  }).toPass({ timeout: 30_000 });
  await slow(
    mgr.page.getByText(`${day}: in 9:00 am, out 5:00 pm, break 0 min`),
  ).toBeVisible();

  await mgr.page.getByRole("button", { name: "Correct", exact: true }).click();
  // nothing changed, then no note
  await mgr.page.getByRole("button", { name: "Save correction" }).click();
  await slow(
    mgr.page.getByText("Say why you are correcting this."),
  ).toBeVisible();
  await mgr.page.getByLabel("Why are you correcting this?").fill(unique("fix"));
  await mgr.page.getByLabel("Break (minutes)").first().fill("45");
  await mgr.page.getByLabel("Clock out (venue time)").fill(`${day}T17:30`);
  await mgr.page.getByRole("button", { name: "Save correction" }).click();
  await slow(
    mgr.page.getByText(`${day}: in 9:00 am, out 5:30 pm, break 45 min`),
  ).toBeVisible();
  await mgr.context.close();
});

test("a custom range, bad dates, backwards and too-long ranges", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "timesheet");

  await showRange(mgr.page, "2025-02-30", "2025-03-01");
  await slow(
    mgr.page.getByText("Write both dates like 2026-11-16."),
  ).toBeVisible();
  await showRange(mgr.page, "soon", "later");
  await slow(
    mgr.page.getByText("Write both dates like 2026-11-16."),
  ).toBeVisible();
  await showRange(mgr.page, "2025-03-10", "2025-03-01");
  await slow(
    mgr.page.getByText("The end date is before the start date."),
  ).toBeVisible();

  await showRange(mgr.page, "2025-03-01", "2025-03-10");
  await slow(mgr.page).toHaveURL(/from=2025-03-01&to=2025-03-10/);
  await slow(mgr.page.getByLabel("From", { exact: true })).toHaveValue(
    "2025-03-01",
  );

  // a range over 92 days or a hand-made bad URL falls back to the current week, not an error page
  await mgr.page.goto(
    `/venues/${mgr.venue}/timesheet?from=2020-01-01&to=2025-01-01`,
  );
  await slow(
    mgr.page.getByRole("heading", { name: "Timesheet", level: 1 }),
  ).toBeVisible();
  await slow(mgr.page.getByLabel("From", { exact: true })).not.toHaveValue(
    "2020-01-01",
  );
  await mgr.page.goto(`/venues/${mgr.venue}/timesheet?from=junk&to=2025-01-01`);
  await slow(
    mgr.page.getByRole("heading", { name: "Timesheet", level: 1 }),
  ).toBeVisible();
  await slow(mgr.page.getByLabel("From", { exact: true })).not.toHaveValue(
    "junk",
  );
  await mgr.page.goto(
    `/venues/${mgr.venue}/timesheet?from=2025-03-10&to=2025-03-01`,
  );
  await slow(mgr.page.getByLabel("From", { exact: true })).not.toHaveValue(
    "2025-03-10",
  );
  await mgr.context.close();
});

test("an empty range says nobody clocked in", async ({ browser }) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "timesheet");
  await showRange(mgr.page, "2001-01-01", "2001-01-07");
  await slow(
    mgr.page.getByText("Nobody clocked in between 2001-01-01 and 2001-01-07."),
  ).toBeVisible();
  await mgr.context.close();
});

test("the CSV download returns CSV with the session and is refused signed out", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const url = `/venues/${mgr.venue}/timesheet/csv?from=2024-01-01&to=2025-12-31`;
  const res = await mgr.page.request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/text\/csv/);
  expect(res.headers()["content-disposition"]).toContain(
    "timesheet-2024-01-01-2025-12-31.csv",
  );
  const body = await res.text();
  expect(body.split("\n")[0]).toMatch(/,/);

  const bad = await mgr.page.request.get(
    `/venues/${mgr.venue}/timesheet/csv?from=x&to=y`,
  );
  expect(bad.status()).toBe(422);

  // the page link points at it
  await openVenuePage(mgr.page, mgr.venue, "timesheet");
  await slow(
    mgr.page.getByRole("link", { name: /Download as a spreadsheet/ }),
  ).toHaveAttribute(
    "href",
    /\/timesheet\/csv\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/,
  );

  const anon = await browser.newContext();
  const out = await anon.request.get(`http://localhost:3000${url}`, {
    maxRedirects: 0,
  });
  expect([307, 308, 302, 303, 401]).toContain(out.status());
  await anon.close();
  await mgr.context.close();
});

test("staff cannot open the timesheet or its CSV, unknown ids are not found", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  await staff.page.goto(`/venues/${staff.venue}/timesheet`);
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  const csv = await staff.page.request.get(
    `/venues/${staff.venue}/timesheet/csv?from=2025-01-01&to=2025-01-31`,
  );
  expect([403, 404]).toContain(csv.status());
  await staff.page.goto("/venues/not-a-uuid/timesheet");
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.page.goto(
    "/venues/00000000-0000-4000-8000-000000000000/timesheet",
  );
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.context.close();
});

test("a bookkeeper has no timesheet right, so the page and its CSV are not found", async ({
  browser,
}) => {
  // roles.md gives timesheet.view to owner, partner and manager only; the navigation hides it for a bookkeeper.
  const bk = await as(browser, "bookkeeper");
  await bk.page.goto(`/venues/${bk.venue}/timesheet`);
  await slow(bk.page.getByText(NOT_FOUND).first()).toBeVisible();
  const csv = await bk.page.request.get(
    `/venues/${bk.venue}/timesheet/csv?from=2025-01-01&to=2025-01-31`,
  );
  expect([403, 404]).toContain(csv.status());
  await bk.context.close();
});

test("the timesheet is usable at phone width with no side scroll", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.setViewportSize({ width: 390, height: 844 });
  await openVenuePage(mgr.page, mgr.venue, "timesheet");
  await slow(
    mgr.page.getByRole("heading", { name: "Timesheet", level: 1 }),
  ).toBeVisible();
  await noSideScroll(mgr.page);
  await mgr.context.close();
});
