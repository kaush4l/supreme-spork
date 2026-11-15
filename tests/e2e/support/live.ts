/**
 * Shared helpers for the live screen tests (the demo venue on the local stack).
 * Run: backend up with `make up` and `APP_ENV=dev make demo` in minder-pass, the UI running (`bun run dev`), then
 *   E2E_LIVE=1 E2E_BASE_URL=http://localhost:3000 PW_CHANNEL=chrome bunx playwright test tests/e2e/live
 * Tests must not depend on exact demo numbers and must create their own data with a unique name (`unique()`),
 * so a rerun on the same data still passes. Reading and writing the demo venue is fine; never reset it.
 */
import { expect, type Page, test } from "@playwright/test";

export const LIVE = process.env.E2E_LIVE === "1";
export const PASSWORD = "demo-pass-2026";
export type Role =
  | "owner"
  | "partner"
  | "manager"
  | "bookkeeper"
  | "staff"
  | "staff2";

/** Put at the top of a live spec: `skipUnlessLive();` */
export function skipUnlessLive() {
  test.skip(!LIVE, "needs the demo stack (E2E_LIVE=1)");
}

/** A name that is new on every run. */
export function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/** Each context gets its own address so the sign-in limit never trips between tests. */
export async function freshAddress(page: Page) {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.context().setExtraHTTPHeaders({
    "x-real-ip": `10.${octet()}.${octet()}.${octet()}`,
  });
}

/** Sign in as a demo role through the real sign-in page and return the demo venue's id. */
export async function signIn(page: Page, role: Role): Promise<string> {
  await freshAddress(page);
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(`demo.${role}@example.com`);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), {
    timeout: 20_000,
  });
  return venueId(page);
}

/** The demo venue's id, read from the signed-in home page's link. */
export async function venueId(page: Page): Promise<string> {
  await page.goto("/");
  // The owner and partner also have an empty second venue; the demo venue's name ends in "(demo)".
  const links = page.locator('a[href^="/venues/"]');
  const demo = links.filter({ hasText: "(demo)" });
  const href = await ((await demo.count()) > 0 ? demo : links)
    .first()
    .getAttribute("href");
  const id = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1];
  expect(id, "the demo venue link on the home page").toBeTruthy();
  return id as string;
}

/** Open a venue page and wait for it to settle. */
export async function openVenuePage(page: Page, id: string, path: string) {
  await page.goto(`/venues/${id}/${path}`);
  await page.waitForLoadState("load");
}

/** Fail the test on a CSP violation or an uncaught page error. Call once per test, before navigating. */
export function watchForBrowserErrors(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    // Next's developer overlay (dev server only) trips the policy itself; that is not our page.
    if (m.location().url.includes("next-devtools")) return;
    if (m.type() === "error" && /Refused to|Content Security/i.test(m.text()))
      problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  return {
    expectNone: () => expect(problems, "browser errors").toEqual([]),
  };
}
