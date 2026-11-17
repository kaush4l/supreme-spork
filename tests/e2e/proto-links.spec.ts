import { expect, test } from "@playwright/test";

const PERSONAS = [
  "owner",
  "partner",
  "manager-money",
  "manager",
  "staff",
  "bookkeeper",
  "multi",
];
const PAGES = [
  "home",
  "money",
  "money/overview",
  "money/dockets",
  "money/labour",
];

test.describe("every in-prototype link resolves", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("no dead /proto anchors on Home and Money pages", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const hrefs = new Set<string>();
    for (const persona of PERSONAS) {
      for (const p of PAGES) {
        await page.goto(`/proto/${persona}/${p}`);
        await page.waitForLoadState("networkidle");
        const found = await page.$$eval("a[href]", (as) =>
          as.map((a) => a.getAttribute("href") ?? ""),
        );
        for (const h of found) if (h.startsWith("/proto")) hrefs.add(h);
      }
    }
    expect(hrefs.size).toBeGreaterThan(20);
    const dead: string[] = [];
    for (const h of hrefs) {
      const res = await request.get(h);
      if (res.status() !== 200) dead.push(`${res.status()} ${h}`);
    }
    expect(dead).toEqual([]);
  });

  test("destinations honour drill-down params", async ({ page }) => {
    await page.goto("/proto/owner/inbox?tab=action&scope=urgent");
    await expect(page.getByText(/Showing: Urgent/)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText(/Showing: Urgent/)).toHaveCount(0);
    await page.goto("/proto/owner/inbox?tab=bogus");
    await expect(page.getByText("Unknown tab in the link")).toBeVisible();
    await page.goto("/proto/owner/inbox?decision=nope-1");
    await expect(page.getByText("Decision not found")).toBeVisible();

    await page.goto("/proto/owner/team/roster?filter=open&day=2026-11-18");
    await expect(page.getByText(/Showing: Open shifts/)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByText(/Showing: Open shifts/)).toHaveCount(0);
    await page.goto("/proto/owner/team/roster?filter=zzz&view=now");
    await expect(page.getByText(/Filter "zzz" is not supported/)).toBeVisible();

    await page.goto("/proto/owner/money/overview?view=cash&week=2026-11-09");
    await expect(page.getByText(/Showing: cash section/)).toBeVisible();
    await page.goto("/proto/owner/money/overview?view=zzz");
    await expect(page.getByText('View "zzz" is not available')).toBeVisible();
  });
});
