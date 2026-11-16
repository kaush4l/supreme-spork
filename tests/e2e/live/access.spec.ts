/**
 * Sign-in, sign-out and who may open which page, against the demo venue (live stack, see support/live.ts).
 * The expected navigation per role mirrors src/server/nav.ts: a page the navigation hides must open as not found.
 */
import {
  type Browser,
  type BrowserContext,
  expect as baseExpect,
  type Page,
  test,
} from "@playwright/test";
import {
  freshAddress,
  PASSWORD,
  type Role,
  signIn,
  skipUnlessLive,
  venueId,
} from "../support/live";

skipUnlessLive();

// the dev server compiles pages on first visit, so give every auto-waiting check longer than the 5 s default
const expect = baseExpect.configure({ timeout: 20_000 });

/**
 * Fail on a CSP violation or an uncaught page error. Like watchForBrowserErrors in support/live.ts, except that
 * violations raised by Next's own dev tools overlay (dev server only, not shipped in a build) are ignored.
 */
function watchForBrowserErrors(
  page: Page,
  options = { ignoreInlineStyle: true },
) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (!/Refused to|Content Security|violates the following/i.test(text))
      return;
    if (m.location().url.includes("next-devtools")) return;
    // Known dev-server noise from Astryx Layer / react-dom; the strict test "no CSP errors on any page" still fails on it.
    if (options.ignoreInlineStyle && /^Applying inline style/.test(text))
      return;
    problems.push(`${text} (${m.location().url})`);
  });
  page.on("pageerror", (e) => {
    // React's dev-only render timing on a page that ends in notFound() ("cannot have a negative time stamp")
    if (/Failed to execute 'measure' on 'Performance'/.test(String(e))) return;
    problems.push(String(e));
  });
  return { expectNone: () => expect(problems, "browser errors").toEqual([]) };
}

const ROLES: Role[] = ["owner", "partner", "manager", "bookkeeper", "staff"];

type Route = { key: string; heading: string; label: string };
const ROUTES: Route[] = [
  { key: "today", heading: "Today", label: "Today" },
  { key: "shifts", heading: "My shifts", label: "My shifts" },
  { key: "lists", heading: "My checklists", label: "My checklists" },
  { key: "requests", heading: "My requests", label: "Requests" },
  { key: "pay", heading: "My pay", label: "My hours" },
  { key: "notices", heading: "Notices", label: "Notices" },
  { key: "board", heading: "Today board", label: "Today board" },
  { key: "roster", heading: "Roster", label: "Roster" },
  { key: "approvals", heading: "Approvals", label: "Approvals" },
  { key: "checklists", heading: "Checklists", label: "Checklist setup" },
  { key: "timesheet", heading: "Timesheet", label: "Timesheet" },
  { key: "team", heading: "Team", label: "Team" },
  { key: "settings", heading: "Settings", label: "Settings" },
  { key: "rules", heading: "Who can do what", label: "Who can do what" },
  { key: "changes", heading: "Change requests", label: "Change requests" },
  { key: "roster-files", heading: "Roster files", label: "Roster files" },
  { key: "week", heading: "This week", label: "This week" },
  { key: "messages", heading: "Monday messages", label: "Monday messages" },
  { key: "dockets", heading: "Dockets", label: "Dockets" },
  { key: "dockets/send", heading: "Send a docket", label: "Send a docket" },
  { key: "suppliers", heading: "Suppliers", label: "Suppliers" },
  { key: "sales-files", heading: "Sales files", label: "Sales files" },
  { key: "recipes", heading: "Recipes", label: "Recipes" },
  { key: "waste", heading: "Waste", label: "Waste" },
  {
    key: "expiry",
    heading: "Licences and expiry",
    label: "Licences and expiry",
  },
  { key: "pnl", heading: "Profit and loss", label: "Profit and loss" },
  { key: "bills", heading: "Bills", label: "Bills" },
  { key: "bank", heading: "Bank questions", label: "Bank questions" },
  { key: "downloads", heading: "Downloads", label: "Downloads" },
];

const MY_WORK = ["today", "shifts", "lists", "requests", "pay", "notices"];
const MANAGE = [
  "board",
  "roster",
  "roster-files",
  "approvals",
  "checklists",
  "timesheet",
  "team",
];
const OWNER = ["settings", "rules", "changes"];

// "Stock and money": the books pages every role but staff reads, then the ones that depend on a right
const BOOKS = [
  "week",
  "messages",
  "dockets",
  "suppliers",
  "sales-files",
  "recipes",
];
const MONEY = ["bills", "bank", "downloads"];

/**
 * What nav.ts shows each role. The demo owner and partner are not on the team (no staff profile), so they get no
 * "My work" links, and "Waste" sits under "Stock and money" for them. The bookkeeper has money.cash, money.exports and
 * money.pnl.view (no staff profile), so it gets the books pages and lands on /week. The manager has expiry.manage and
 * money.cash but not money.pnl.view, and sends dockets from "Dockets". Staff get "Waste" and "Send a docket".
 */
const NAV: Record<Role, string[]> = {
  owner: [...MANAGE, ...BOOKS, "waste", "expiry", "pnl", ...MONEY, ...OWNER],
  partner: [...MANAGE, ...BOOKS, "waste", "expiry", "pnl", ...MONEY, ...OWNER],
  manager: [
    ...MY_WORK,
    "waste",
    ...MANAGE,
    "changes",
    ...BOOKS,
    "expiry",
    "bills",
    "bank",
  ],
  bookkeeper: [...BOOKS, "waste", "pnl", ...MONEY],
  staff: [...MY_WORK, "waste", "dockets/send"],
  staff2: [...MY_WORK, "waste", "dockets/send"],
};
/**
 * Pages that open (anything else is "not found"). A page can open without being in the navigation: the backend decides,
 * so everyone may read their own notices and their own change requests, a manager may read the venue settings, and
 * the three roles that decide dockets (owner, partner, manager) may also send one (they use the Dockets page for it).
 */
const ALLOWED: Record<Role, string[]> = {
  owner: ["notices", "dockets/send", ...NAV.owner],
  partner: ["notices", "dockets/send", ...NAV.partner],
  manager: [...NAV.manager, "settings", "dockets/send"],
  bookkeeper: [...NAV.bookkeeper, "changes"],
  staff: NAV.staff,
  staff2: NAV.staff2,
};
const FIRST_PAGE: Partial<Record<Role, string>> = {
  owner: "/attention",
  partner: "/attention",
  manager: "/attention",
  bookkeeper: "/week",
  staff: "/today",
};

const NOT_FOUND = /could not be found|not found/i;

async function expectNotFound(page: Page) {
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: new RegExp(`^(${ROUTES.map((r) => r.heading).join("|")})$`),
    }),
  ).toHaveCount(0);
}

async function expectNoErrorPage(page: Page) {
  await expect(page.getByRole("button", { name: /try again/i })).toHaveCount(0);
  await expect(
    page.getByText(/application error|something went wrong/i),
  ).toHaveCount(0);
}

/** Sign in once per role and hand out fresh contexts that carry the session. */
function sessionFor(role: Role) {
  let state: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let venue = "";
  return {
    async prepare(browser: Browser) {
      const context = await browser.newContext();
      const page = await context.newPage();
      venue = await signIn(page, role);
      state = await context.storageState();
      await context.close();
    },
    async open(browser: Browser) {
      const context = await browser.newContext({ storageState: state });
      const page = await context.newPage();
      await freshAddress(page);
      return { context, page, venue };
    },
  };
}

test.describe("sign in", () => {
  for (const role of ROLES) {
    test(`${role} signs in and lands on the right first page`, async ({
      page,
    }) => {
      const watch = watchForBrowserErrors(page);
      const id = await signIn(page, role);
      const first = FIRST_PAGE[role];
      if (first) {
        await page.goto(`/venues/${id}`);
        await expect(page).toHaveURL(new RegExp(`/venues/${id}${first}$`));
      } else {
        await page.goto(`/venues/${id}`);
        await expectNoErrorPage(page);
        await expect(page).not.toHaveURL(/sign-in/);
      }
      watch.expectNone();
    });
  }

  test("sign-in itself goes to the venue's first page, not back to sign-in", async ({
    page,
  }) => {
    await freshAddress(page);
    await page.goto("/sign-in");
    await page.waitForLoadState("load");
    await page.getByLabel(/email/i).fill("demo.manager@example.com");
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/sign-in/, { timeout: 20_000 });
  });

  test("a wrong password shows a plain error and stays on sign-in", async ({
    page,
  }) => {
    await freshAddress(page);
    await page.goto("/sign-in");
    await page.waitForLoadState("load");
    await page.getByLabel(/email/i).fill("demo.owner@example.com");
    await page.getByLabel(/password/i).fill("definitely-wrong-pass-1");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(
      page.getByText("That email and password do not match."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByText(/exception|traceback|\b4\d\d\b|\b5\d\d\b/i),
    ).toHaveCount(0);
  });

  test("an unknown email shows a plain error and stays on sign-in", async ({
    page,
  }) => {
    await freshAddress(page);
    await page.goto("/sign-in");
    await page.waitForLoadState("load");
    await page.getByLabel(/email/i).fill(`nobody-${Date.now()}@example.com`);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(
      page.getByText(/do not match|Check the details/),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("signed out", () => {
  test("every protected page goes to sign-in and returns to the page afterwards", async ({
    page,
  }) => {
    const id = await signIn(page, "manager");
    await page.context().clearCookies();
    for (const key of ["board", "roster", "today", "team"]) {
      await page.goto(`/venues/${id}/${key}`);
      await expect(page).toHaveURL(/\/sign-in/);
      await page.waitForLoadState("load");
    }
    await page.goto(`/venues/${id}/roster`);
    await expect(page).toHaveURL(/\/sign-in/);
    await freshAddress(page);
    await page.waitForLoadState("load");
    await page.getByLabel(/email/i).fill("demo.manager@example.com");
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(new RegExp(`/venues/${id}/roster`), {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "Roster" }),
    ).toBeVisible();
  });

  test("sign out works and the back button shows no private data", async ({
    page,
  }) => {
    const id = await signIn(page, "manager");
    await page.goto(`/venues/${id}/board`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Today board" }),
    ).toBeVisible();
    await page.goto("/");
    await page.getByRole("button", { name: "Sign out of this device" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goBack();
    await page.goBack().catch(() => {});
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Today board" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Your venues" }),
    ).toHaveCount(0);
    // and a reload of any private page is refused too
    await page.goto(`/venues/${id}/board`);
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("venue ids", () => {
  test("a malformed and an unknown venue id show not found", async ({
    page,
  }) => {
    await signIn(page, "owner");
    for (const bad of ["not-a-venue", "00000000-0000-0000-0000-000000000000"]) {
      const res = await page.goto(`/venues/${bad}/board`);
      expect(res?.status()).toBeLessThan(500);
      await expectNotFound(page);
    }
    const res = await page.goto("/venues/not-a-venue");
    expect(res?.status()).toBeLessThan(500);
    await expectNotFound(page);
  });
});

for (const role of ROLES) {
  test.describe(`access as ${role}`, () => {
    const session = sessionFor(role);
    test.beforeAll(async ({ browser }) => {
      await session.prepare(browser);
    });

    for (const route of ROUTES) {
      const allowed = ALLOWED[role].includes(route.key);
      test(`${route.key} ${allowed ? "opens" : "is not found"}`, async ({
        browser,
      }) => {
        const { context, page, venue } = await session.open(browser);
        const watch = watchForBrowserErrors(page);
        const res = await page.goto(`/venues/${venue}/${route.key}`);
        if (allowed) {
          expect(res?.status()).toBeLessThan(400);
          await expect(
            page.getByRole("heading", { level: 1, name: route.heading }),
          ).toBeVisible();
          await expectNoErrorPage(page);
        } else {
          await expectNotFound(page);
        }
        await page.waitForLoadState("load");
        watch.expectNone();
        await context.close();
      });
    }

    test("the navigation shows exactly the items for this role", async ({
      browser,
    }) => {
      const { context, page, venue } = await session.open(browser);
      await page.goto(
        `/venues/${venue}/${NAV[role][0] ?? ALLOWED[role][0] ?? "today"}`,
      );
      await page.waitForLoadState("load");
      const links = page.locator(`a[href^="/venues/${venue}/"]`);
      if (NAV[role].length > 0) await expect(links.first()).toBeAttached();
      const want = ROUTES.filter((r) => NAV[role].includes(r.key))
        .map((r) => r.label)
        .sort();
      await expect
        .poll(async () =>
          // a page may repeat a navigation label in its own content (the bookkeeper's This week links to Profit and loss)
          [
            ...new Set(
              (
                await links.evaluateAll((els) =>
                  els.map((e) => (e.textContent ?? "").trim()),
                )
              ).filter((t) => t && ROUTES.some((r) => r.label === t)),
            ),
          ].sort(),
        )
        .toEqual(want);
      await context.close();
    });
  });
}

test.describe("browser errors", () => {
  test("no CSP errors on any page, for any role", async ({ browser }) => {
    test.setTimeout(600_000);
    for (const role of ROLES) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const watch = watchForBrowserErrors(page, { ignoreInlineStyle: false });
      const id = await signIn(page, role);
      for (const route of ROUTES.filter((r) => ALLOWED[role].includes(r.key))) {
        await page.goto(`/venues/${id}/${route.key}`, { waitUntil: "load" });
        await page.waitForTimeout(800); // some pages never go network-idle; styles are applied right after load
      }
      watch.expectNone();
      await context.close();
    }
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const session = sessionFor("staff");
  test.beforeAll(async ({ browser }) => {
    await session.prepare(browser);
  });

  for (const key of MY_WORK) {
    test(`staff ${key} fits a 390 wide screen`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        storageState: await (async () => {
          const s = await session.open(browser);
          const st = await s.context.storageState();
          await s.context.close();
          return st;
        })(),
      });
      const page = await context.newPage();
      const id = await venueId(page);
      await page.goto(`/venues/${id}/${key}`);
      const route = ROUTES.find((r) => r.key === key) as Route;
      await expect(
        page.getByRole("heading", { level: 1, name: route.heading }),
      ).toBeVisible();
      await page.waitForLoadState("load");
      const [scroll, client] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scroll, "page scroll width").toBeLessThanOrEqual(client);
      await context.close();
    });
  }
});
