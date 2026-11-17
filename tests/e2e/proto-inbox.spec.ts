import { expect, type Page, test } from "@playwright/test";

const EVIDENCE =
  "/Users/thusharsadhansabu/code/myprojects/minder-pass-documents/ui/redesign/phase-2/evidence/inbox";

test.use({ viewport: { width: 390, height: 844 } });

const num = async (page: Page, label: string) => {
  const t = await page
    .getByText(new RegExp(`^${label} \\d+$`))
    .first()
    .innerText();
  return Number(t.replace(/\D+/g, ""));
};
const openTab = (page: Page, name: string) =>
  page.getByRole("tab", { name: new RegExp(name) }).click();
const resetFixtures = async (page: Page) => {
  await page
    .getByText("Prototype controls (scenario, reset, sign-out)")
    .click();
  await page.getByRole("button", { name: "Reset fixtures" }).click();
};

test.describe("V06 another actor resolves an unread action", () => {
  test("count drops after Refresh, unread stays, outcome replaces action", async ({
    page,
  }) => {
    await page.goto("/proto/manager/inbox");
    await expect(
      page.getByRole("tab", { name: /Action needed/ }),
    ).toBeVisible();
    const unresolved0 = await num(page, "Unresolved actions");
    const unread0 = await num(page, "Unread");
    const chosen = (await page.getByText(/^Chosen item: /).innerText()).replace(
      "Chosen item: ",
      "",
    );
    await page
      .getByRole("button", { name: "Another manager resolves an action" })
      .click();
    // Nothing visible changes until Refresh.
    await expect(page.getByText(/1 change happened elsewhere/)).toBeVisible();
    expect(await num(page, "Unresolved actions")).toBe(unresolved0);
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect
      .poll(() => num(page, "Unresolved actions"))
      .toBe(unresolved0 - 1);
    expect(await num(page, "Unread")).toBe(unread0);
    const row = page.getByRole("listitem", { name: chosen, exact: true });
    await expect(row.getByText("Resolved by another manager")).toBeVisible();
    await expect(
      row.getByText("Unread", { exact: true }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: `${EVIDENCE}/v06-after-refresh-390.png`,
      fullPage: true,
    });
    // Detail: outcome replaces the action; opening marks it read.
    await row.getByRole("link").click();
    await expect(page.getByRole("heading", { name: chosen })).toBeVisible();
    await expect(
      page.getByText("Resolved by another manager").first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Decline" })).toHaveCount(0);
    await expect(page.getByText("Read: yes")).toBeVisible();
    await expect(page.getByText("Resolved: yes")).toBeVisible();
    await page.getByRole("link", { name: "Back to Inbox" }).first().click();
    await expect.poll(() => num(page, "Unread")).toBe(unread0 - 1);
    expect(await num(page, "Unresolved actions")).toBe(unresolved0 - 1);
  });

  test("another staff member fills an offer", async ({ page }) => {
    await page.goto("/proto/manager/inbox");
    const chosen = (await page.getByText(/^Chosen item: /).innerText()).replace(
      "Chosen item: ",
      "",
    );
    await page
      .getByRole("button", { name: "Another staff member fills an offer" })
      .click();
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page
        .getByRole("listitem", { name: chosen, exact: true })
        .getByText("This shift was filled by another staff member"),
    ).toBeVisible();
  });
});

test.describe("V07 three distinct transitions", () => {
  test("read notice, acknowledge announcement, mark all read are independent", async ({
    page,
  }) => {
    await page.goto("/proto/manager/inbox");
    const action0 = {
      unread: await num(page, "Unread"),
      unresolved: await num(page, "Unresolved actions"),
    };

    // 1. Read one notice (Updates): unread -1 only.
    await openTab(page, "Updates");
    const upd0 = await num(page, "Unread");
    await page
      .getByRole("button", { name: /^Mark read: / })
      .first()
      .click();
    await expect.poll(() => num(page, "Unread")).toBe(upd0 - 1);

    // 2. Acknowledge an announcement: awaiting -1, unread unchanged.
    await openTab(page, "Announcements");
    const annUnread0 = await num(page, "Unread");
    const awaiting0 = await num(page, "Awaiting acknowledgement");
    expect(awaiting0).toBeGreaterThan(0);
    await page
      .getByRole("button", { name: /^Acknowledge: / })
      .first()
      .click();
    await expect
      .poll(() => num(page, "Awaiting acknowledgement"))
      .toBe(awaiting0 - 1);
    expect(await num(page, "Unread")).toBe(annUnread0);

    // 3. Mark all read in Updates with explicit confirmation copy.
    await openTab(page, "Updates");
    await page.getByRole("button", { name: "Mark all updates read" }).click();
    await expect(
      page.getByText(
        /does not acknowledge any announcement and does not resolve any action/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Yes, mark all read" }),
    ).toBeFocused();
    await page.screenshot({ path: `${EVIDENCE}/v07-mark-all-confirm-390.png` });
    await page.getByRole("button", { name: "Yes, mark all read" }).click();
    await expect.poll(() => num(page, "Unread")).toBe(0);
    await expect(
      page.getByRole("button", { name: "Mark all updates read" }),
    ).toBeFocused();

    // Independent: announcements and action untouched by mark all read.
    await openTab(page, "Announcements");
    expect(await num(page, "Unread")).toBe(annUnread0);
    expect(await num(page, "Awaiting acknowledgement")).toBe(awaiting0 - 1);
    await openTab(page, "Action needed");
    expect(await num(page, "Unread")).toBe(action0.unread);
    expect(await num(page, "Unresolved actions")).toBe(action0.unresolved);
    await expect(
      page.getByRole("button", { name: /Mark all .* read/ }),
    ).toHaveCount(0);
  });

  test("reading a notice does not acknowledge it", async ({ page }) => {
    await page.goto("/proto/manager/inbox");
    await openTab(page, "Announcements");
    const row = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: /^Acknowledge: / }) })
      .first();
    await row.getByRole("link").click();
    await expect(page.getByText("Read: yes")).toBeVisible();
    await expect(page.getByText("Acknowledged: no")).toBeVisible();
    await page
      .getByRole("button", { name: "Acknowledge", exact: true })
      .click();
    await expect(page.getByText("Acknowledged: yes")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Acknowledge", exact: true }),
    ).toHaveCount(0);
  });
});

test.describe("V14 removed, revoked, wrong venue, signed-out", () => {
  test("removed subject offers no action and a recovery destination", async ({
    page,
  }) => {
    await page.goto("/proto/manager/inbox");
    await page
      .getByRole("link", { name: /Cash variance to explain #5/ })
      .click();
    await expect(
      page.getByText("This is no longer available").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Approve|Decline|Acknowledge/ }),
    ).toHaveCount(0);
    await page.screenshot({ path: `${EVIDENCE}/v14-removed-390.png` });
    await page.getByRole("link", { name: "Back to Inbox" }).first().click();
    await expect(
      page.getByRole("tab", { name: /Action needed/ }),
    ).toBeVisible();
  });

  test("revoked access shows summary only", async ({ page }) => {
    await page.goto("/proto/manager/inbox");
    await page
      .getByRole("link", { name: /Leave request awaiting decision #9/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "You no longer have access" }),
    ).toBeVisible();
    await expect(page.getByText(/Synthetic action notice 9/)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Approve|Decline|Acknowledge/ }),
    ).toHaveCount(0);
    await page.screenshot({ path: `${EVIDENCE}/v14-revoked-390.png` });
    await expect(
      page.getByRole("link", { name: "Back to Inbox" }).first(),
    ).toBeVisible();
  });

  test("wrong venue explains and never switches silently", async ({ page }) => {
    await page.goto("/proto/multi/inbox/v-perth~u-multi:act-003");
    await expect(
      page.getByText("This is in Swan River Bar").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Approve|Decline/ }),
    ).toHaveCount(0);
    await page.screenshot({ path: `${EVIDENCE}/v14-wrong-venue-390.png` });
    await page
      .getByRole("button", { name: "Switch to Swan River Bar" })
      .click();
    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(
      "#3",
    );
  });

  test("signed-out keeps the deep link and returns to it", async ({ page }) => {
    await page.goto("/proto/manager/inbox");
    await page
      .getByRole("link", { name: /Shift offer: Friday close #3/ })
      .click();
    await expect(
      page.getByRole("heading", { name: /Shift offer: Friday close #3/ }),
    ).toBeVisible();
    const url = page.url();
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Sign out (simulation)" }).click();
    await expect(page.getByText(/Simulated sign-out/)).toBeVisible();
    expect(page.url()).toBe(url);
    await page.screenshot({ path: `${EVIDENCE}/v14-signed-out-390.png` });
    await page
      .getByRole("button", { name: "Sign back in (simulation)" })
      .click();
    await expect(
      page.getByRole("heading", { name: /Shift offer: Friday close #3/ }),
    ).toBeVisible();
  });

  test("Me page sign out and documented contract", async ({ page }) => {
    await page.goto("/proto/staff/me");
    await expect(page.locator("#account")).toBeVisible();
    await expect(page.locator("#notifications")).toBeVisible();
    await expect(
      page
        .getByText(
          /Production sign-out contract \(not simulated here\): revoke this device/,
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText("Not supported by the current backend").first(),
    ).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/me-390.png`, fullPage: true });
    await page.getByRole("button", { name: "Sign out (simulation)" }).click();
    await expect(
      page.getByText(/no real push subscription was revoked/),
    ).toBeVisible();
  });

  test("announcements: denied without rights, publish with rights", async ({
    page,
  }) => {
    await page.goto("/proto/staff/team/announcements");
    await expect(page.getByText("Not available for your access")).toBeVisible();
    await page.goto("/proto/manager/team/announcements");
    await page.getByRole("button", { name: "Publish (simulated)" }).click();
    await expect(
      page.getByText("Add a title and a message before publishing."),
    ).toBeVisible();
    await page.getByLabel("Title").fill("Fire drill Friday");
    await page.getByLabel("Message").fill("Assemble at the car park.");
    await page.getByRole("button", { name: "Publish (simulated)" }).click();
    await expect(page.getByText("Sent announcements (3)")).toBeVisible();
    await expect(page.getByText("Fire drill Friday")).toBeVisible();
  });
});

test.describe("V15 reset and duplicate submit", () => {
  test("double submit applies once; reset restores the start", async ({
    page,
  }) => {
    await page.goto("/proto/manager/inbox");
    await page
      .getByRole("link", { name: /Shift offer: Friday close #3/ })
      .click();
    await expect(
      page.getByText("Simulated changes applied this session: 1"),
    ).toHaveCount(0);
    const approve = page.getByRole("button", { name: "Approve" });
    await expect(approve).toBeVisible();
    // Two synchronous clicks before React re-renders: the second must be ignored.
    const base = Number(
      (
        await page
          .getByText(/Simulated changes applied this session: \d+/)
          .innerText()
      ).replace(/\D+/g, ""),
    );
    await approve.evaluate((b) => {
      (b as HTMLElement).click();
      (b as HTMLElement).click();
    });
    await expect(page.getByText("Resolved: yes")).toBeVisible();
    await expect(
      page.getByText(`Simulated changes applied this session: ${base + 1}`),
    ).toBeVisible();
    await expect(page.getByText("Approved by you").first()).toBeVisible();
    await resetFixtures(page);
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
    await expect(page.getByText("Resolved: no")).toBeVisible();
  });

  test("simulated error keeps state and allows retry", async ({ page }) => {
    await page.goto("/proto/manager/inbox?scenario=default");
    await page
      .getByRole("link", { name: /Shift offer: Friday close #3/ })
      .click();
    await page
      .getByText("Prototype controls (scenario, reset, sign-out)")
      .click();
    await page.getByRole("combobox", { name: "Scenario" }).click();
    await page.getByRole("option", { name: "Error" }).click();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});

test.describe("restoration of tab, filter, pages and scroll", () => {
  test("load more, scroll, open, return", async ({ page }) => {
    await page.goto("/proto/manager/inbox");
    await expect(page.getByText(/^Showing 20 of 24$/)).toBeVisible();
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByText(/^Showing 24 of 24$/)).toBeVisible();
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(500);
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(800);
    await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href*='/inbox/']"),
      );
      const hit = links.find((a) => {
        const r = a.getBoundingClientRect();
        return r.top > 80 && r.bottom < window.innerHeight - 80 && r.width > 0;
      });
      hit?.click();
    });
    await page.getByRole("link", { name: "Back to Inbox" }).first().click();
    await expect(page.getByText(/^Showing 24 of 24$/)).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
      .toBeGreaterThan(y - 60);
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - y),
    ).toBeLessThan(60);
  });

  test("tab and unread-only filter survive a detail round trip", async ({
    page,
  }) => {
    await page.goto("/proto/manager/inbox");
    await openTab(page, "Updates");
    await page.getByLabel("Unread only").check();
    const shown = await page.getByText(/^Showing \d+ of \d+$/).innerText();
    await page
      .getByRole("link", {
        name: /Roster published|Your swap was approved|Docket approved|Shift time changed/,
      })
      .first()
      .click();
    await page.getByRole("link", { name: "Back to Inbox" }).first().click();
    await expect(page.getByRole("tab", { name: /Updates/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("Unread only")).toBeChecked();
    // The opened item became read, so one fewer unread remains in the filtered list.
    const after = await page.getByText(/^Showing \d+ of \d+$/).innerText();
    expect(Number(after.split(" of ")[1])).toBe(
      Number(shown.split(" of ")[1]) - 1,
    );
  });

  test("busy scenario has three pages", async ({ page }) => {
    await page.goto("/proto/manager/inbox?scenario=busy");
    await expect(page.getByText("Showing 20 of 64")).toBeVisible();
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByText("Showing 40 of 64")).toBeVisible();
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByText("Showing 60 of 64")).toBeVisible();
  });
});

test.describe("states and viewports", () => {
  for (const scenario of ["empty", "error", "stale", "slow", "partial"]) {
    test(`scenario ${scenario} renders a labelled state`, async ({ page }) => {
      await page.goto(`/proto/manager/inbox?scenario=${scenario}`);
      if (scenario === "empty")
        await expect(
          page.getByText(/No action needed right now/),
        ).toBeVisible();
      if (scenario === "error")
        await expect(
          page.getByText(/could not be loaded/).first(),
        ).toBeVisible();
      if (scenario === "stale")
        await expect(
          page.getByText("This data may be out of date"),
        ).toBeVisible();
      if (scenario === "slow")
        await expect(
          page.getByRole("tab", { name: /Action needed/ }),
        ).toBeVisible({ timeout: 6000 });
      if (scenario === "partial")
        await expect(
          page.getByText("Status unavailable, retry").first(),
        ).toBeVisible();
    });
  }

  test("no horizontal overflow and keyboard focus visible", async ({
    page,
  }) => {
    for (const size of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/proto/manager/inbox");
      await expect(
        page.getByRole("tab", { name: /Action needed/ }),
      ).toBeVisible();
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(over).toBeLessThanOrEqual(1);
      if (size.width === 390 || size.width === 1440)
        await page.screenshot({
          path: `${EVIDENCE}/inbox-${size.width}.png`,
          fullPage: true,
        });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/proto/manager/inbox");
    await page.getByRole("tab", { name: /Action needed/ }).focus();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });
});
