/** Helpers shared by the owner-team, owner-settings and owner-changes live specs. */
import { expect as baseExpect, type Page } from "@playwright/test";

/** The dev server is slow when several suites run at once, so wait longer than the 5 s default. */
export const expect = baseExpect.configure({ timeout: 20_000 });

export const MAILPIT = "http://localhost:8025/api/v1";

/** The demo venue's id. The owner also has a second, empty venue, so pick the one named "(demo)". */
export async function demoVenue(page: Page): Promise<string> {
  await page.goto("/");
  const link = page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: /\(demo\)/ });
  const href = await link.first().getAttribute("href");
  const id = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1];
  expect(id, "the demo venue link on the home page").toBeTruthy();
  return id as string;
}

export async function open(page: Page, venue: string, path: string) {
  await page.goto(`/venues/${venue}/${path}`);
  await page.waitForLoadState("load");
}

/** No sideways scrolling at phone width. */
export async function expectNoSideScroll(page: Page) {
  const wide = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(wide, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

/** A person's card on the team page: the innermost box holding their name and an Edit (or Close, while editing) button. */
export function personCard(page: Page, name: string) {
  return page
    .locator("div")
    .filter({ has: page.getByText(name, { exact: true }) })
    .filter({ has: page.getByRole("button", { name: /^(Edit|Close)$/ }) })
    .last();
}

/** Wait until the page's server rendering has caught up with a write (the refreshed list shows the text). */
export const errorBanner = (page: Page) =>
  page.locator('[data-status="error"]');

/** Mail that Mailpit caught for an address; polls until one arrives. */
export async function mailTo(page: Page, address: string) {
  let found: { ID: string; Subject: string } | undefined;
  await expect
    .poll(
      async () => {
        const r = await page.request.get(
          `${MAILPIT}/search?query=${encodeURIComponent(`to:${address}`)}`,
        );
        const body = (await r.json()) as {
          messages: { ID: string; Subject: string }[];
        };
        found = body.messages[0];
        return found?.ID ?? "";
      },
      { message: `an email to ${address}`, timeout: 30_000 },
    )
    .not.toBe("");
  const full = await page.request.get(`${MAILPIT}/message/${found?.ID}`);
  const m = (await full.json()) as {
    Text: string;
    HTML: string;
    Subject: string;
  };
  return { subject: m.Subject, text: m.Text ?? "", html: m.HTML ?? "" };
}

/**
 * Fail the test on a CSP violation or an uncaught page error from our own pages. Same as watchForBrowserErrors, except
 * that messages raised by Next's developer overlay (dev server only, `next-devtools` chunk) are ignored: they are the
 * overlay's own inline styles, not the app's.
 */
export function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.location().url.includes("next-devtools")) return;
    // Dev-server noise from Astryx Layer / react-dom ("Applying inline style ..."), also ignored in access.spec.ts, which
    // keeps the strict "no CSP errors on any page" check for it.
    if (/^Applying inline style/.test(m.text())) return;
    if (m.type() === "error" && /Refused to|Content Security/i.test(m.text()))
      problems.push(m.text());
  });
  page.on("pageerror", (e) => {
    // React's dev build measuring a layout across a quick navigation; not shipped in a build.
    if (/cannot have a negative time stamp/.test(String(e))) return;
    problems.push(String(e));
  });
  return { expectNone: () => expect(problems, "browser errors").toEqual([]) };
}
