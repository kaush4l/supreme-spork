import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";
import { api, must, staffIds, venuePath } from "../support/staff-api";
import { watchCsp } from "./manager-ops-helpers";

skipUnlessLive();
test.setTimeout(240_000);
test.use({ actionTimeout: 30_000 });
const slow = expect.configure({ timeout: 25_000 });

const NOT_FOUND = /could not be found|not found/i;
/** The demo's week with readings in it. */
const FROM = "2026-11-09";
const TO = "2026-11-15";
const WEEK = `readings?from=${FROM}&to=${TO}`;

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

/** A checklist with one fridge reading (0 to 5), given to Ana for the demo week, issued, with the list found. */
async function makeFridgeList() {
  const v = await venuePath();
  const name = unique("Fridge check");
  const label = unique("Fridge C");
  const template = await must(
    api("manager", "POST", `${v}/workflows/templates`, {
      name,
      items: [{ label, kind: "number", min_value: 0, max_value: 5 }],
    }),
    "template",
  );
  const ana = (await staffIds())["Ana Silva"];
  const rule = await must(
    api("manager", "POST", `${v}/workflows/rules`, {
      template_key: template.template_key,
      target_kind: "person",
      staff_id: ana,
      timing_kind: "shift_start",
    }),
    "rule",
  );
  await must(
    api("manager", "POST", `${v}/workflows/issue`, { week: FROM }),
    "issue",
  );
  const lists = await must(
    api(
      "manager",
      "GET",
      `${v}/workflows/lists?from=${FROM}&to=${TO}&limit=200`,
    ),
    "lists",
  );
  const list = (lists.items as { id: string; name: string }[]).find(
    (l) => l.name === name,
  );
  if (!list) throw new Error("no list was issued for the new checklist");
  const itemKey = template.items[0].item_key as string;
  const answer = (number: number) =>
    must(
      api(
        "manager",
        "POST",
        `${v}/workflows/lists/${list.id}/items/${itemKey}/answer`,
        { number },
      ),
      "answer",
    );
  const clean = async () => {
    await api(
      "manager",
      "POST",
      `${v}/workflows/rules/${rule.rule_key}/deactivate`,
    );
    await api(
      "manager",
      "POST",
      `${v}/workflows/templates/${template.template_key}/retire`,
    );
  };
  return { name, label, answer, clean };
}

test("owner and manager open the readings log: a table with real rows and a CSV link that downloads", async ({
  browser,
}) => {
  for (const role of ["manager", "owner"] as const) {
    const who = await as(browser, role);
    const watch = watchCsp(who.page);
    await openVenuePage(who.page, who.venue, WEEK);
    await slow(
      who.page.getByRole("heading", { name: "Readings log", level: 1 }),
    ).toBeVisible();
    await slow(who.page.getByText(/\d+ readings? from /)).toBeVisible();
    await slow(
      who.page.getByRole("columnheader", { name: "Reading" }),
    ).toBeVisible();
    await slow(
      who.page.getByRole("columnheader", { name: "Result" }),
    ).toBeVisible();
    await slow(who.page.getByText("Out of range").first()).toBeVisible();

    const link = who.page.getByRole("link", {
      name: /Download as a spreadsheet/,
    });
    await expect(link).toHaveAttribute(
      "href",
      new RegExp(`/readings/csv\\?from=${FROM}&to=${TO}$`),
    );
    const csv = await who.page.request.get(
      `/venues/${who.venue}/readings/csv?from=${FROM}&to=${TO}`,
    );
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toMatch(
      /^trading_day,answered_at,list_id,list_name,item_key,label,value,/,
    );
    watch.expectNone();
    await who.context.close();
  }
});

test("a reading out of range on a fresh list shows up with the words, then a corrected one reads in range", async ({
  browser,
}) => {
  const fridge = await makeFridgeList();
  try {
    await fridge.answer(9);
    const mgr = await as(browser, "manager");
    await openVenuePage(mgr.page, mgr.venue, WEEK);
    const row = mgr.page.getByRole("row").filter({ hasText: fridge.label });
    await slow(row).toHaveCount(1);
    await expect(row).toContainText("Out of range");
    await expect(row).toContainText("0 to 5");
    await expect(row).toContainText("9");
    await expect(row).toContainText(fridge.name);

    // the csv carries the same reading
    const csv = await mgr.page.request.get(
      `/venues/${mgr.venue}/readings/csv?from=${FROM}&to=${TO}`,
    );
    expect(await csv.text()).toContain(fridge.label);

    // a corrected answer replaces it: the log shows the latest one only
    await fridge.answer(4);
    await mgr.page.reload();
    await slow(row).toHaveCount(1);
    await expect(row).toContainText("In range");
    await expect(row).not.toContainText("Out of range");
    await mgr.context.close();
  } finally {
    await fridge.clean();
  }
});

test("a range that is too long gets the backend's sentence, and an empty range says so", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.goto(
    `/venues/${mgr.venue}/readings?from=2026-08-01&to=2026-10-15`,
  );
  await slow(
    mgr.page.getByText("Ask for at most 31 days at a time."),
  ).toBeVisible();
  await mgr.page.goto(
    `/venues/${mgr.venue}/readings?from=2030-01-01&to=2030-01-07`,
  );
  await slow(
    mgr.page.getByText(
      "No readings were saved between 2030-01-01 and 2030-01-07.",
    ),
  ).toBeVisible();
  // the form narrows the range and a backwards range is refused before it is sent
  await mgr.page.getByLabel("From", { exact: true }).fill("2030-02-01");
  await mgr.page.getByLabel("To", { exact: true }).fill("2030-01-07");
  await mgr.page.getByRole("button", { name: "Show", exact: true }).click();
  await slow(
    mgr.page.getByText("The end date is before the start date."),
  ).toBeVisible();
  await mgr.page.getByLabel("From", { exact: true }).fill(FROM);
  await mgr.page.getByLabel("To", { exact: true }).fill(TO);
  await mgr.page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(mgr.page).toHaveURL(
    new RegExp(`readings\\?from=${FROM}&to=${TO}`),
  );
  await slow(mgr.page.getByText(/\d+ readings? from /)).toBeVisible();
  await mgr.context.close();
});

test("the owner's second venue has no readings; staff cannot open the page", async ({
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
  expect(bondi, "the Bondi venue link").toBeTruthy();
  await owner.page.goto(`/venues/${bondi}/${WEEK}`);
  await slow(
    owner.page.getByRole("heading", { name: "Readings log", level: 1 }),
  ).toBeVisible();
  await slow(
    owner.page.getByText(`No readings were saved between ${FROM} and ${TO}.`),
  ).toBeVisible();
  await owner.context.close();

  const staff = await as(browser, "staff");
  await staff.page.goto(`/venues/${staff.venue}/${WEEK}`);
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.page.request
    .get(`/venues/${staff.venue}/readings/csv?from=${FROM}&to=${TO}`)
    .then((r) => expect(r.status()).not.toBe(200));
  await staff.context.close();
});

test("the readings log is usable at phone width with no side scroll", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.setViewportSize({ width: 390, height: 844 });
  await openVenuePage(mgr.page, mgr.venue, WEEK);
  await slow(
    mgr.page.getByRole("heading", { name: "Readings log", level: 1 }),
  ).toBeVisible();
  await slow(mgr.page.getByText(/\d+ readings? from /)).toBeVisible();
  await noSideScroll(mgr.page);
  await mgr.context.close();
});
