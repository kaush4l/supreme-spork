import { expect as baseExpect, test } from "@playwright/test";
import { signIn, skipUnlessLive, unique } from "../support/live";
import { api, watchApp } from "../support/staff-api";

skipUnlessLive();
test.use({ actionTimeout: 15_000 });
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ mode: "serial", timeout: 120_000 });

const PAGES = [
  ["profile", "My profile"],
  ["certificates", "My certificates"],
  ["work", "Where I work"],
  ["availability", "My availability"],
  ["calendar", "My calendar link"],
] as const;

async function noPay(page: import("@playwright/test").Page) {
  await expect(page.locator('[name*="pay" i], [name*="rate" i]')).toHaveCount(
    0,
  );
  const text = (await page.locator("body").innerText()).toLowerCase();
  expect(text).not.toMatch(/\bpay\b|hourly|wage|salary|\$\s?\d/);
}

test("signed out, the pages send you to sign in", async ({ page }) => {
  for (const [path] of PAGES) {
    await page.goto(`/account/${path}`);
    await page.waitForURL(/\/sign-in/);
  }
});

test("every page opens with real data, no pay, and fits a phone", async ({
  page,
}) => {
  const errors = watchApp(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page, "staff2");
  for (const [path, title] of PAGES) {
    await page.goto(`/account/${path}`);
    await expect(
      page.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    await noPay(page);
    const wide = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(wide, `${path} overflow`).toBeLessThanOrEqual(0);
  }
  await page.goto("/account/certificates");
  await expect(page.getByRole("heading", { name: /^RSA/ })).toBeVisible();
  await expect(
    page.getByText("Copied from a venue you work at").first(),
  ).toBeVisible();
  await page.goto("/account/work");
  await expect(page.getByRole("link", { name: /\(demo\)/ })).toBeVisible();
  await expect(page.getByText("Waiter")).toBeVisible();
  await page.goto("/");
  for (const label of [
    "My profile",
    "My certificates",
    "Where I work",
    "My availability",
    "My calendar link",
  ])
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  errors.expectNone();
});

test("profile: change the headline, see it saved, put it back", async ({
  page,
}) => {
  const errors = watchApp(page);
  await signIn(page, "staff2");
  const was =
    (await api("staff2", "GET", "/v1/me/profile")).json.headline ?? "";
  const next = unique("Floor");
  try {
    await page.goto("/account/profile");
    const box = page.getByRole("textbox", { name: /Headline/ });
    await box.fill(next);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    await page.reload();
    await expect(box).toHaveValue(next);
    // a pay field is refused by the API itself
    const refused = await api("staff2", "POST", "/v1/me/profile", {
      hourly_cost_cents: 1,
    });
    expect(refused.status).toBe(422);
  } finally {
    await api("staff2", "POST", "/v1/me/profile", {
      headline: was === "" ? null : was,
    });
  }
  await page.reload();
  await expect(page.getByRole("textbox", { name: /Headline/ })).toHaveValue(
    was,
  );
  errors.expectNone();
});

test("certificates: add one (double click writes once), correct it, remove it", async ({
  page,
}) => {
  const errors = watchApp(page);
  await signIn(page, "staff2");
  const number = unique("FA").replace(/ /g, "-");
  const list = async () =>
    (await api("staff2", "GET", "/v1/me/certificates")).json as {
      kind: string;
      number: string | null;
    }[];
  try {
    await page.goto("/account/certificates");
    await page.getByRole("combobox", { name: "Kind" }).click();
    await page.getByRole("option", { name: "First aid" }).click();
    await page.getByRole("textbox", { name: /Number/ }).fill(number);
    await page
      .getByRole("combobox", { name: /Expires on/ })
      .first()
      .fill("1/12/2030");
    await page.getByRole("button", { name: "Add certificate" }).dblclick();
    await expect(page.getByText("Certificate saved.")).toBeVisible();
    await expect(page.getByText(`Number ${number}`)).toBeVisible();
    expect((await list()).filter((c) => c.kind === "first_aid")).toHaveLength(
      1,
    );

    await page
      .getByRole("heading", { name: "First aid" })
      .locator("xpath=ancestor::*[.//button[contains(.,'Correct')]][1]")
      .getByRole("button", { name: "Correct" })
      .click();
    await page.getByRole("textbox", { name: /Number/ }).fill(`${number}b`);
    await page.getByRole("button", { name: "Save correction" }).click();
    await expect(page.getByText(`Number ${number}b`)).toBeVisible();

    await page
      .getByRole("heading", { name: "First aid" })
      .locator("xpath=ancestor::*[.//button[contains(.,'Remove')]][1]")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(page.getByText(/Remove your First aid/)).toBeVisible();
    await page
      .getByRole("button", { name: "Remove", exact: true })
      .last()
      .click();
    await expect(page.getByText("Certificate removed.")).toBeVisible();
    expect((await list()).some((c) => c.kind === "first_aid")).toBe(false);
  } finally {
    if ((await list()).some((c) => c.kind === "first_aid"))
      await api("staff2", "POST", "/v1/me/certificates/first_aid/remove");
  }
  // the demo RSA is still there
  expect((await list()).some((c) => c.kind === "rsa")).toBe(true);
  errors.expectNone();
});

test("availability: add a one-day entry once, then remove it", async ({
  page,
}) => {
  const errors = watchApp(page);
  await signIn(page, "staff2");
  const note = unique("Away");
  const mine = async () =>
    (
      (await api("staff2", "GET", "/v1/me/availability")).json as {
        id: string;
        note: string | null;
      }[]
    ).filter((r) => r.note === note);
  try {
    await page.goto("/account/availability");
    await page.getByRole("combobox", { name: "How often" }).click();
    await page
      .getByRole("option", { name: "One day or a run of days" })
      .click();
    await page
      .getByRole("combobox", { name: /First day/ })
      .first()
      .fill("1/12/2031");
    await page.getByRole("textbox", { name: /Note/ }).fill(note);
    await page.getByRole("button", { name: "Add", exact: true }).dblclick();
    await expect(page.getByText("Added.")).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();
    expect(await mine()).toHaveLength(1);
    await page
      .getByText(note)
      .locator("xpath=ancestor::*[.//button[contains(.,'Remove')]][1]")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(page.getByText("Removed.")).toBeVisible();
    expect(await mine()).toHaveLength(0);
  } finally {
    for (const r of await mine())
      await api("staff2", "POST", `/v1/me/availability/${r.id}/remove`);
  }
  errors.expectNone();
});

test("calendar: make a link once, it works, then turn it off", async ({
  page,
}) => {
  const errors = watchApp(page);
  await signIn(page, "staff2");
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  try {
    await page.goto("/account/calendar");
    const had = await page
      .getByRole("button", { name: "Make a new link" })
      .count();
    if (had > 0) {
      await page
        .getByRole("button", { name: "Make a new link" })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Make a new link" })
        .last()
        .click();
    } else {
      await page.getByRole("button", { name: "Make my link" }).dblclick();
    }
    const field = page.getByRole("textbox", { name: "Calendar link" });
    await expect(field).toHaveValue(/\/v1\/me\/calendar\/.+\.ics$/);
    await expect(page.getByText(/shown only this once/)).toBeVisible();
    const link = await field.inputValue();
    const feed = await page.request.get(link);
    expect(feed.status()).toBe(200);
    expect(await feed.text()).toContain("BEGIN:VCALENDAR");
    await page.getByRole("button", { name: "Copy link" }).click();
    await page.reload();
    await expect(page.getByText(/cannot be shown again/)).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Calendar link" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Turn the link off" }).click();
    await expect(
      page.getByText(/Calendars using it stop updating/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Turn off", exact: true }).click();
    await expect(page.getByText(/old link no longer works/)).toBeVisible();
    await expect(
      page.getByText("You do not have a calendar link."),
    ).toBeVisible();
    expect((await page.request.get(link)).status()).toBe(404);
  } finally {
    await api("staff2", "POST", "/v1/me/calendar/revoke");
  }
  errors.expectNone();
});
