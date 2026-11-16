import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";
import { api, localDay, must, staffIds, venuePath } from "../support/staff-api";
import { pickerDate, pickerTime } from "./manager-helpers";
import { watchCsp } from "./manager-ops-helpers";

skipUnlessLive();
test.setTimeout(240_000);
test.use({ actionTimeout: 30_000 });
const slow = expect.configure({ timeout: 25_000 });

const NOT_FOUND = /could not be found|not found/i;
/** The demo's week the fridge list is issued into. */
const FROM = "2026-11-09";
const TO = "2026-11-15";

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

/** How many Server Action posts the page sends: a double click must send one write. */
function countWrites(page: Page) {
  let n = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) n += 1;
  });
  return () => n;
}

/**
 * A checklist with one fridge reading (0 to 5) for the demo week, and a reading of 9 saved through the backend, which
 * raises a follow-up. Returns the follow-up's id, its title and the list id; `clean` closes what was made.
 */
async function makeFollowUp() {
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
  await must(
    api(
      "manager",
      "POST",
      `${v}/workflows/lists/${list.id}/items/${template.items[0].item_key}/answer`,
      { number: 9 },
    ),
    "answer",
  );
  const readings = await must(
    api("manager", "GET", `${v}/checklists/readings?from=${FROM}&to=${TO}`),
    "readings",
  );
  const row = (
    readings.items as { label: string; corrective_action_id: string | null }[]
  ).find((r) => r.label === label);
  const id = row?.corrective_action_id;
  if (!id) throw new Error("the out of range reading raised no follow-up");
  const get = () =>
    must(api("manager", "GET", `${v}/corrective-actions/${id}`), "get");
  const first = await get();
  const clean = async () => {
    // A follow-up cannot be removed: close it so the open list stays short.
    await api("manager", "POST", `${v}/corrective-actions/${id}/cancel`, {
      reason: "e2e clean up",
    });
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
  return {
    id,
    listId: list.id,
    label,
    title: first.title as string,
    get,
    clean,
  };
}

/** Walk the pages of a filter until the follow-up's link shows (the open list is ordered by due time, not by age). */
async function findInList(
  page: Page,
  venue: string,
  state: string,
  id: string,
) {
  await page.goto(`/venues/${venue}/actions?state=${state}`);
  const link = page.locator(`a[href$="/actions/${id}"]`);
  for (let i = 0; i < 20; i += 1) {
    await expect(
      page.getByRole("heading", { name: "Follow-ups", level: 1 }),
    ).toBeVisible();
    if ((await link.count()) > 0) return link;
    const more = page.getByRole("link", { name: "More", exact: true });
    if ((await more.count()) === 0) break;
    await more.click();
    await page.waitForLoadState("load");
  }
  return link;
}

test("owner and manager see a raised follow-up in the list, on its page, in the readings log and in the menu", async ({
  browser,
}) => {
  const made = await makeFollowUp();
  try {
    for (const role of ["manager", "owner"] as const) {
      const who = await as(browser, role);
      const watch = watchCsp(who.page);
      const link = await findInList(who.page, who.venue, "open", made.id);
      await slow(link).toBeVisible();
      await slow(
        who.page.getByRole("link", { name: "Follow-ups" }).first(),
      ).toBeVisible();

      await link.click();
      await slow(
        who.page.getByRole("heading", { name: made.title, level: 1 }),
      ).toBeVisible();
      await expect(who.page.getByText("Owner: Nobody yet")).toBeVisible();
      await expect(who.page.getByText(/^Due: /)).toBeVisible();
      await expect(
        who.page.getByRole("link", { name: "Open the checklist" }),
      ).toHaveAttribute("href", `/venues/${who.venue}/board/${made.listId}`);
      await expect(
        who.page.getByRole("link", { name: "Open the readings log" }),
      ).toHaveAttribute("href", `/venues/${who.venue}/readings`);
      await expect(
        who.page.getByRole("button", { name: "Mark done" }),
      ).toBeVisible();

      // The readings log says so on the out of range row, with a link to the follow-up.
      await openVenuePage(
        who.page,
        who.venue,
        `readings?from=${FROM}&to=${TO}`,
      );
      const row = who.page.getByRole("row").filter({ hasText: made.label });
      await slow(row).toHaveCount(1);
      await expect(row).toContainText("Out of range");
      await expect(
        row.getByRole("link", { name: "Follow-up open" }),
      ).toHaveAttribute("href", `/venues/${who.venue}/actions/${made.id}`);
      watch.expectNone();
      await who.context.close();
    }
  } finally {
    await made.clean();
  }
});

test("staff and a bookkeeper get not found for the list and for a follow-up", async ({
  browser,
}) => {
  const made = await makeFollowUp();
  try {
    for (const role of ["staff", "bookkeeper"] as const) {
      const who = await as(browser, role);
      await who.page.goto(`/venues/${who.venue}/actions`);
      await slow(who.page.getByText(NOT_FOUND).first()).toBeVisible();
      await who.page.goto(`/venues/${who.venue}/actions/${made.id}`);
      await slow(who.page.getByText(NOT_FOUND).first()).toBeVisible();
      await expect(
        who.page.getByRole("button", { name: "Mark done" }),
      ).toHaveCount(0);
      await who.context.close();
    }
  } finally {
    await made.clean();
  }
});

test("a manager gives the follow-up to the manager and the owner, clears it and moves the due time", async ({
  browser,
}) => {
  const made = await makeFollowUp();
  try {
    const mgr = await as(browser, "manager");
    const writes = countWrites(mgr.page);
    await mgr.page.goto(`/venues/${mgr.venue}/actions/${made.id}`);
    await slow(mgr.page.getByText("Owner: Nobody yet")).toBeVisible();

    // Pick people from the owners list (the demo names are the sign-in addresses), then clear it.
    const choose = async (name: string) => {
      await mgr.page.getByRole("combobox", { name: "Owner" }).click();
      await mgr.page.getByRole("option", { name, exact: true }).click();
      await mgr.page.getByRole("button", { name: "Change the owner" }).click();
    };
    await choose("demo.manager@example.com");
    await slow(mgr.page.getByText("The owner was changed.")).toBeVisible();
    await slow(
      mgr.page.getByText("Owner: demo.manager@example.com"),
    ).toBeVisible();
    const manager = (await made.get()).owner_user_id;
    expect(manager).not.toBeNull();

    await choose("demo.owner@example.com");
    await slow(
      mgr.page.getByText("Owner: demo.owner@example.com"),
    ).toBeVisible();
    expect((await made.get()).owner_user_id).not.toBe(manager);

    await choose("Nobody");
    await slow(mgr.page.getByText("The owner was cleared.")).toBeVisible();
    await slow(mgr.page.getByText("Owner: Nobody yet")).toBeVisible();
    expect((await made.get()).owner_user_id).toBeNull();

    // A new due time typed as the venue's clock is sent with the venue's zone and lands on that wall time.
    const day = localDay(5);
    await mgr.page
      .locator('input[placeholder="Select a date"]')
      .first()
      .fill(pickerDate(day));
    await mgr.page.keyboard.press("Enter");
    const time = mgr.page.getByLabel("Due (venue time) time");
    await time.fill(pickerTime("09:30"));
    await time.press("Enter");
    const before = writes();
    await mgr.page.getByRole("button", { name: "Change the due time" }).click();
    await slow(mgr.page.getByText("The due time was changed.")).toBeVisible();
    expect(writes() - before).toBe(1);
    const due = (await made.get()).due_at as string;
    const wall = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(new Date(due))
      .replace(", ", "T");
    expect(wall).toBe(`${day}T09:30`);
    await mgr.context.close();
  } finally {
    await made.clean();
  }
});

test("done needs a note, a double click writes once, and the closed follow-up is read only", async ({
  browser,
}) => {
  const made = await makeFollowUp();
  try {
    const mgr = await as(browser, "manager");
    const writes = countWrites(mgr.page);
    await mgr.page.goto(`/venues/${mgr.venue}/actions/${made.id}`);
    const done = mgr.page.getByRole("button", { name: "Mark done" });
    await slow(done).toBeVisible();

    // No note: refused on the page and nothing is sent.
    await done.click();
    await slow(
      mgr.page.getByText("Write what was done before marking it done."),
    ).toBeVisible();
    expect(writes()).toBe(0);
    expect((await made.get()).state).toBe("open");

    const note = unique("Moved the stock");
    await mgr.page.getByLabel("What was done").fill(note);
    await done.dblclick();
    await slow(mgr.page.getByText(`Note: ${note}`)).toBeVisible();
    await expect(mgr.page.getByText(/Marked done by /)).toBeVisible();
    expect(writes()).toBe(1);
    const closed = await made.get();
    expect(closed.state).toBe("done");
    expect(closed.note).toBe(note);

    // Closed is closed: no buttons on the page, and the backend refuses another close.
    await expect(
      mgr.page.getByRole("button", { name: "Mark done" }),
    ).toHaveCount(0);
    await expect(
      mgr.page.getByRole("button", { name: "Cancel this follow-up" }),
    ).toHaveCount(0);
    await expect(mgr.page.getByLabel("What was done")).toHaveCount(0);
    const again = await api(
      "manager",
      "POST",
      `${await venuePath()}/corrective-actions/${made.id}/cancel`,
      { reason: "too late" },
    );
    expect(again.status).toBe(409);

    // It leaves the open list and is under Done.
    const doneLink = await findInList(mgr.page, mgr.venue, "done", made.id);
    await slow(doneLink).toBeVisible();
    await mgr.context.close();
  } finally {
    await made.clean();
  }
});

test("cancel needs a reason, a double click writes once, and the reason is shown", async ({
  browser,
}) => {
  const made = await makeFollowUp();
  try {
    const mgr = await as(browser, "manager");
    const writes = countWrites(mgr.page);
    await mgr.page.goto(`/venues/${mgr.venue}/actions/${made.id}`);
    const cancel = mgr.page.getByRole("button", {
      name: "Cancel this follow-up",
    });
    await slow(cancel).toBeVisible();
    await cancel.click();
    await slow(
      mgr.page.getByText("Write why it is being cancelled."),
    ).toBeVisible();
    expect(writes()).toBe(0);
    expect((await made.get()).state).toBe("open");

    const reason = unique("Fridge was defrosting");
    await mgr.page.getByLabel("Why it is cancelled").fill(reason);
    await cancel.dblclick();
    await slow(mgr.page.getByText(`Reason: ${reason}`)).toBeVisible();
    await expect(mgr.page.getByText(/Cancelled by /)).toBeVisible();
    expect(writes()).toBe(1);
    expect((await made.get()).state).toBe("cancelled");
    await expect(
      mgr.page.getByRole("button", { name: "Mark done" }),
    ).toHaveCount(0);

    // The Cancelled filter holds it; the readings log now says so.
    await mgr.page.goto(`/venues/${mgr.venue}/actions`);
    await mgr.page
      .getByRole("link", { name: "Cancelled", exact: true })
      .click();
    await expect(mgr.page).toHaveURL(/actions\?state=cancelled/);
    await slow(
      mgr.page.locator(`a[href$="/actions/${made.id}"]`),
    ).toBeVisible();
    await openVenuePage(mgr.page, mgr.venue, `readings?from=${FROM}&to=${TO}`);
    await slow(
      mgr.page
        .getByRole("row")
        .filter({ hasText: made.label })
        .getByRole("link", { name: "Follow-up cancelled" }),
    ).toBeVisible();
    await mgr.context.close();
  } finally {
    await made.clean();
  }
});

test("the owner's second venue has no follow-ups", async ({ browser }) => {
  const owner = await as(browser, "owner");
  await owner.page.goto("/");
  const href = await owner.page
    .locator('a[href^="/venues/"]')
    .filter({ hasText: "Bondi" })
    .first()
    .getAttribute("href");
  const bondi = href?.match(/\/venues\/([0-9a-f-]{36})/)?.[1];
  expect(bondi, "the Bondi venue link").toBeTruthy();
  await owner.page.goto(`/venues/${bondi}/actions`);
  await slow(
    owner.page.getByRole("heading", { name: "Follow-ups", level: 1 }),
  ).toBeVisible();
  await slow(
    owner.page.getByText("Nothing is waiting for a follow-up."),
  ).toBeVisible();
  await owner.page.goto(`/venues/${bondi}/actions?state=all`);
  await slow(owner.page.getByText("No follow-ups here.")).toBeVisible();
  await owner.context.close();
});

test("the list and a follow-up are usable at phone width with no side scroll", async ({
  browser,
}) => {
  const made = await makeFollowUp();
  try {
    const mgr = await as(browser, "manager");
    await mgr.page.setViewportSize({ width: 390, height: 844 });
    const link = await findInList(mgr.page, mgr.venue, "open", made.id);
    await slow(link).toBeVisible();
    await noSideScroll(mgr.page);
    await link.click();
    await slow(
      mgr.page.getByRole("heading", { name: made.title, level: 1 }),
    ).toBeVisible();
    await expect(
      mgr.page.getByRole("button", { name: "Mark done" }),
    ).toBeVisible();
    await noSideScroll(mgr.page);
    await mgr.context.close();
  } finally {
    await made.clean();
  }
});
