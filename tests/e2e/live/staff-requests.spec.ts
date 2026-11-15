import { expect, type Page, test } from "@playwright/test";
import { openVenuePage, signIn, skipUnlessLive, unique } from "../support/live";
import {
  api,
  cancelShift,
  makeShift,
  must,
  shownAs,
  venuePath,
  watchApp,
} from "../support/staff-api";

skipUnlessLive();
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: "serial" });
const expectSoon = expect.configure({ timeout: 20_000 });

/** The date field is typed month/day/year. */
const typedOf = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;

/** A day in 2031 that is new on each call, as ISO and as typed and as the request text writes it. */
function someDay(plus = 0) {
  const base =
    Date.UTC(2031, 0, 1) +
    Math.floor(Math.random() * 700) * 86_400_000 +
    plus * 86_400_000;
  const d = new Date(base);
  const iso = d.toISOString().slice(0, 10);
  const typed = typedOf(d);
  const wk = d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
  });
  const mon = d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
  });
  const text = `${wk} ${String(d.getUTCDate()).padStart(2, "0")} ${mon}`;
  return { iso, typed, text, human: `${wk}, ${d.getUTCDate()} ${mon}` };
}

async function typeDate(page: Page, label: string | RegExp, typed: string) {
  const box = page.getByRole("combobox", { name: label });
  await box.fill(typed);
  await box.press("Tab");
}

async function openRequests(page: Page) {
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, "requests");
  await expectSoon(
    page.getByRole("heading", { name: "My requests", level: 1 }),
  ).toBeVisible();
  return id;
}

async function myRequestId(description: RegExp): Promise<string> {
  const v = await venuePath();
  const list = (await must(
    api("staff", "GET", `${v}/me/requests`),
    "requests",
  )) as { id: string; description: string }[];
  const hit = list.filter((r) => description.test(r.description)).at(-1); // the newest one
  if (!hit) throw new Error("request not found");
  return hit.id;
}

test("leave with valid dates and a reason is sent and shows as waiting", async ({
  page,
}) => {
  await openRequests(page);
  const a = someDay();
  const end = new Date(`${a.iso}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const endTyped = typedOf(end);
  await typeDate(page, "First day", a.typed);
  await typeDate(page, /Last day/, endTyped);
  await page
    .getByRole("textbox", { name: /Reason/ })
    .first()
    .fill(unique("Family"));
  await page.getByRole("button", { name: "Send request" }).first().click();
  await expectSoon(
    page.getByText("Sent. Your manager will reply."),
  ).toBeVisible();
  await expectSoon(
    page.getByText(new RegExp(`asks for leave: ${a.text} to `)).first(),
  ).toBeVisible();
  await expectSoon(
    page.getByText("Leave · Waiting for your manager").first(),
  ).toBeVisible();
});

test("a one-day leave without a reason is accepted", async ({ page }) => {
  await openRequests(page);
  const a = someDay();
  await typeDate(page, "First day", a.typed);
  await page.getByRole("button", { name: "Send request" }).first().click();
  await expectSoon(
    page.getByText("Sent. Your manager will reply."),
  ).toBeVisible();
  await expectSoon(
    page.getByText(new RegExp(`asks for leave: ${a.text}$`)),
  ).toBeVisible();
});

test("a manager approves one leave and rejects another, and the staff page shows both", async ({
  page,
}) => {
  const approved = someDay();
  const rejected = someDay();
  const v = await venuePath();
  for (const d of [approved, rejected])
    await must(
      api("staff", "POST", `${v}/me/requests/leave`, {
        start_date: d.iso,
        end_date: d.iso,
        reason: "e2e",
      }),
      "leave",
    );
  const yes = await myRequestId(new RegExp(`leave: ${approved.text}$`));
  const no = await myRequestId(new RegExp(`leave: ${rejected.text}$`));
  await must(
    api("manager", "POST", `${v}/requests/${yes}/approve`, {
      note: "Enjoy the break",
    }),
    "approve",
  );
  await must(
    api("manager", "POST", `${v}/requests/${no}/reject`, {
      note: "We are short that day",
    }),
    "reject",
  );
  await openRequests(page);
  const card = (t: string) =>
    page
      .locator("div")
      .filter({ hasText: `leave: ${t}` })
      .filter({ hasText: /Leave · / })
      .last();
  await expectSoon(card(approved.text)).toContainText("Approved");
  await expectSoon(card(approved.text)).toContainText(
    "Manager said: Enjoy the break",
  );
  await expectSoon(card(rejected.text)).toContainText("Not approved");
  await expectSoon(card(rejected.text)).toContainText(
    "Manager said: We are short that day",
  );
});

test("leave that ends before it starts is refused in plain words", async ({
  page,
}) => {
  await openRequests(page);
  const a = someDay(5);
  await typeDate(page, "First day", a.typed);
  const before = new Date(`${a.iso}T00:00:00Z`);
  before.setUTCDate(before.getUTCDate() - 2);
  await typeDate(page, /Last day/, typedOf(before));
  await page.getByRole("button", { name: "Send request" }).first().click();
  await expectSoon(
    page.getByText("The last day is before the first day."),
  ).toBeVisible();
  await expect(page.getByText("Sent. Your manager will reply.")).toHaveCount(0);
});

test("sending leave without a first day asks for one", async ({ page }) => {
  await openRequests(page);
  await page.getByRole("button", { name: "Send request" }).first().click();
  await expectSoon(page.getByText("Choose the first day.")).toBeVisible();
});

test("leave over a blocked date is refused and the blocked dates are listed", async ({
  page,
}) => {
  const v = await venuePath();
  const a = someDay();
  const reason = unique("Busy");
  const made = await must(
    api("manager", "POST", `${v}/roster/blackouts`, {
      start_date: a.iso,
      end_date: a.iso,
      reason,
    }),
    "blackout",
  );
  try {
    await openRequests(page);
    await expectSoon(
      page.getByText("Leave cannot be asked for on these dates:"),
    ).toBeVisible();
    await expectSoon(page.getByText(new RegExp(`${reason}$`))).toBeVisible();
    await typeDate(page, "First day", a.typed);
    await page.getByRole("button", { name: "Send request" }).first().click();
    await expectSoon(
      page.getByText(/Leave cannot be requested for/),
    ).toBeVisible();
    await expect(page.getByText(new RegExp(reason)).nth(1)).toBeVisible();
  } finally {
    await api("manager", "POST", `${v}/roster/blackouts/${made.id}/remove`, {});
  }
});

test("a swap with a colleague is sent, appears, and the manager's answer shows", async ({
  page,
}) => {
  const shift = await makeShift();
  try {
    await openRequests(page);
    await page.getByRole("combobox", { name: "Your shift" }).click();
    const shown = await shownAs(shift.id, shift.day);
    await page
      .getByRole("option", { name: `${shown.day}, ${shown.span} (Bartender)` })
      .first()
      .click();
    await page.getByRole("button", { name: /Colleague/ }).click();
    await page.getByRole("option", { name: /Ana Silva/ }).click();
    await page.getByRole("button", { name: "Send request" }).nth(1).click();
    await expectSoon(
      page.getByText("Sent. Your manager will decide."),
    ).toBeVisible();
    await expectSoon(
      page.getByText(/asks Ana Silva to take the/).first(),
    ).toBeVisible();
    await expectSoon(
      page.getByText("Shift swap · Waiting for your manager").first(),
    ).toBeVisible();
    const id = await myRequestId(/asks Ana Silva to take the/);
    const v = await venuePath();
    await must(
      api("manager", "POST", `${v}/requests/${id}/reject`, { note: "Keep it" }),
      "reject",
    );
    await page.reload();
    await expectSoon(
      page.getByText("Manager said: Keep it").first(),
    ).toBeVisible();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a swap needs a shift and a colleague", async ({ page }) => {
  const shift = await makeShift();
  try {
    await openRequests(page);
    await page.getByRole("button", { name: "Send request" }).nth(1).click();
    await expectSoon(
      page.getByText("Choose a shift and a colleague."),
    ).toBeVisible();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a person with no requests sees the empty sentence", async ({ page }) => {
  const v = await venuePath();
  const mine = await must(
    api("manager", "GET", `${v}/me/requests`),
    "requests",
  );
  test.skip(mine.length > 0, "the manager login has requests");
  const id = await signIn(page, "manager");
  await openVenuePage(page, id, "requests");
  await expectSoon(
    page.getByText("You have not asked for anything yet."),
  ).toBeVisible();
});

test("phone width has no sideways scroll, and an unknown venue is not found", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRequests(page);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const response = await page.goto(
    "/venues/00000000-0000-4000-8000-000000000000/requests",
  );
  expect(response?.status()).toBe(404);
});
