import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
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

test("a bookkeeper opens the P&L on the last finished week with the form, basis, lines and CSV link", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  const watch = watchCsp(bk.page);
  await openVenuePage(bk.page, bk.venue, "pnl");
  await slow(
    bk.page.getByRole("heading", { name: "Profit and loss", level: 1 }),
  ).toBeVisible();
  await slow(bk.page.getByLabel("From", { exact: true })).toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await slow(
    bk.page.getByRole("link", { name: /Download as a spreadsheet/ }),
  ).toHaveAttribute("href", /pnl\/csv\?period=week&from=/);
  await slow(
    bk.page.getByText("How these figures are worked out"),
  ).toBeVisible();
  await slow(bk.page.getByText(/^Labour: /).first()).toBeVisible();
  watch.expectNone();
  await bk.context.close();
});

test("a range with sales shows its lines, what is missing, and each line's rows page", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await openVenuePage(bk.page, bk.venue, "pnl");
  await showRange(bk.page, "2026-11-02", "2026-11-08");
  await slow(bk.page).toHaveURL(/from=2026-11-02&to=2026-11-08/);
  await slow(bk.page.getByText(/^Dine in: /).first()).toBeVisible();
  await slow(
    bk.page.getByText("What is missing or not complete").first(),
  ).toBeVisible();
  await bk.page
    .getByRole("link", { name: /^See the \d+ .* behind Labour/ })
    .first()
    .click();
  await slow(
    bk.page.getByRole("heading", { name: "Rows behind a line", level: 1 }),
  ).toBeVisible();
  await slow(bk.page.getByText(/in all\./)).toBeVisible();
  await slow(bk.page.getByText(/^Person: /).first()).toBeVisible();
  await bk.context.close();
});

test("a too-long range shows the API's sentence, and bad dates are caught", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await openVenuePage(bk.page, bk.venue, "pnl");
  await showRange(bk.page, "soon", "later");
  await slow(
    bk.page.getByText("Write both dates like 2026-11-16."),
  ).toBeVisible();
  await bk.page.goto(
    `/venues/${bk.venue}/pnl?period=day&from=2020-01-01&to=2026-01-01`,
  );
  await slow(
    bk.page.getByText(/Choose a range of 93 days or less/),
  ).toBeVisible();
  await bk.context.close();
});

test("the P&L CSV and a rows page are refused for a bad request and signed out", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  const url = `/venues/${bk.venue}/pnl/csv?period=week&from=2026-11-02&to=2026-11-08`;
  const res = await bk.page.request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/text\/csv/);
  expect(res.headers()["content-disposition"]).toContain(
    "pnl-week-2026-11-02-2026-11-08.csv",
  );
  expect((await res.text()).split("\n")[0]).toMatch(/,/);
  const bad = await bk.page.request.get(
    `/venues/${bk.venue}/pnl/csv?from=x&to=y`,
  );
  expect(bad.status()).toBe(422);
  const anon = await browser.newContext();
  const out = await anon.request.get(`http://localhost:3000${url}`, {
    maxRedirects: 0,
  });
  expect([307, 308, 302, 303, 401]).toContain(out.status());
  await anon.close();
  await bk.context.close();
});

test("the downloads page offers each dataset and the files come through the handler", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await openVenuePage(bk.page, bk.venue, "downloads");
  await slow(
    bk.page.getByRole("heading", { name: "Downloads", level: 1 }),
  ).toBeVisible();
  for (const d of ["sales", "purchases", "bank", "labour"])
    await slow(
      bk.page.getByRole("link", { name: new RegExp(`^Download ${d}`) }),
    ).toBeVisible();
  // the exports are limited to 10 a window, so one real file here
  const res = await bk.page.request.get(
    `/venues/${bk.venue}/downloads/labour?from=2026-11-02&to=2026-11-08`,
  );
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/text\/csv/);
  const unknown = await bk.page.request.get(
    `/venues/${bk.venue}/downloads/pnl?from=2026-11-02&to=2026-11-08`,
  );
  expect(unknown.status()).toBe(404);
  await bk.context.close();
});

test("a click on a download makes one file, and an over-limit range answers in a sentence", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await openVenuePage(bk.page, bk.venue, "downloads");
  await showRange2(bk.page, "2026-11-02", "2026-11-08");
  let hits = 0;
  bk.page.on("request", (r) => {
    if (r.url().includes("/downloads/sales")) hits++;
  });
  const link = bk.page.getByRole("link", { name: "Download sales (CSV)" });
  const [file] = await Promise.all([
    bk.page.waitForEvent("download"),
    link.dblclick(),
  ]);
  expect(file.suggestedFilename()).toBe("sales-2026-11-02-2026-11-08.csv");
  expect(hits).toBe(1);

  await showRange2(bk.page, "2020-01-01", "2026-11-08");
  await bk.page.getByRole("link", { name: "Download sales (CSV)" }).click();
  await slow(
    bk.page.getByText("Choose a range of 366 days or fewer."),
  ).toBeVisible();
  await showRange2(bk.page, "2026-11-08", "2026-11-02");
  await bk.page.getByRole("link", { name: "Download sales (CSV)" }).click();
  await slow(
    bk.page.getByText("The end date is before the start date."),
  ).toBeVisible();
  await bk.context.close();
});

async function showRange2(page: Page, from: string, to: string) {
  await page.getByLabel("From", { exact: true }).fill(from);
  await page.getByLabel("To", { exact: true }).fill(to);
}

test("a manager gets not found on both pages and both handlers", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  for (const path of ["pnl", "downloads"]) {
    await mgr.page.goto(`/venues/${mgr.venue}/${path}`);
    await slow(mgr.page.getByText(NOT_FOUND).first()).toBeVisible();
  }
  for (const path of [
    "pnl/csv?from=2026-11-02&to=2026-11-08",
    "downloads/sales?from=2026-11-02&to=2026-11-08",
  ]) {
    const res = await mgr.page.request.get(`/venues/${mgr.venue}/${path}`);
    expect([403, 404]).toContain(res.status());
  }
  await mgr.page.goto(
    `/venues/${mgr.venue}/pnl/sources?line=labour&from=2026-11-02&to=2026-11-08`,
  );
  await slow(mgr.page.getByText(NOT_FOUND).first()).toBeVisible();
  await mgr.context.close();
});

test("the owner's empty Bondi venue says what is missing instead of showing zeros", async ({
  browser,
}) => {
  const owner = await as(browser, "owner");
  await owner.page.goto("/");
  const href = await owner.page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: "Bondi" })
    .first()
    .getAttribute("href");
  const bondi = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1];
  expect(bondi).toBeTruthy();
  await owner.page.goto(`/venues/${bondi}/pnl`);
  await slow(
    owner.page.getByRole("heading", { name: "Profit and loss", level: 1 }),
  ).toBeVisible();
  await slow(
    owner.page.getByText("What is missing or not complete").first(),
  ).toBeVisible();
  await slow(owner.page.getByText(/No figure/).first()).toBeVisible();
  await owner.context.close();
});

test("both pages work at phone width with no side scroll", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await bk.page.setViewportSize({ width: 390, height: 844 });
  await openVenuePage(bk.page, bk.venue, "pnl");
  await bk.page.goto(
    `/venues/${bk.venue}/pnl?period=week&from=2026-11-02&to=2026-11-08`,
  );
  await slow(bk.page.getByText(/^Dine in: /).first()).toBeVisible();
  await noSideScroll(bk.page);
  await openVenuePage(bk.page, bk.venue, "downloads");
  await slow(
    bk.page.getByRole("heading", { name: "Downloads", level: 1 }),
  ).toBeVisible();
  await noSideScroll(bk.page);
  await bk.context.close();
});
