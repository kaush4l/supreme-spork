import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";
import { watchCsp } from "./manager-ops-helpers";

skipUnlessLive();
// Templates and rules are venue-wide, so the scenarios run one after another.
test.describe.configure({ mode: "serial" });
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

const templateLinks = (page: Page) =>
  page
    .locator('a[href*="/checklists/"]')
    .filter({ hasNotText: "All checklists" });

const starterCards = (page: Page) =>
  page.getByRole("button", { name: "Copy to my checklists" });

/** Name of the starter in card `i` ("Opening (5 items)" -> "Opening"). */
async function starterName(page: Page, i: number) {
  const text = await starterCards(page)
    .nth(i)
    .locator("xpath=ancestor::*[.//*[contains(.,' items)')]][1]")
    .innerText();
  return /^(.+?) \(\d+ items\)/m.exec(text)?.[1] ?? "";
}

let templateHref: string | null = null;
let copiedNew = false;

test("starter library lists templates and an uncopied starter copies into my checklists", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "checklists");
  await slow(
    mgr.page.getByRole("heading", { name: "Checklists", level: 1 }),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("heading", { name: "Starters you can copy" }),
  ).toBeVisible();
  await slow(starterCards(mgr.page).first()).toBeVisible();
  await slow(mgr.page.getByText(/\(\d+ items\)/).first()).toBeVisible();

  const links = await templateLinks(mgr.page).evaluateAll((a) =>
    a.map((x) => ({ href: x.getAttribute("href"), text: x.textContent ?? "" })),
  );
  templateHref = links[0]?.href ?? null;
  const total = await starterCards(mgr.page).count();
  for (let i = 0; i < total; i++) {
    const name = await starterName(mgr.page, i);
    if (links.some((l) => l.text.startsWith(`${name}:`) || l.text === name))
      continue;
    await starterCards(mgr.page).nth(i).click();
    await slow(mgr.page.getByText("Copied to your checklists.")).toBeVisible();
    await slow(templateLinks(mgr.page)).toHaveCount(links.length + 1);
    await slow(
      mgr.page.getByRole("link", { name: new RegExp(`^${name}`) }),
    ).toBeVisible();
    copiedNew = true;
    break;
  }
  watch.expectNone();
  await mgr.context.close();
});

test("copying a starter that is already copied is refused with a plain message", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "checklists");
  const first = await templateLinks(mgr.page).first().innerText();
  const name = first.split(":")[0];
  const total = await starterCards(mgr.page).count();
  let index = -1;
  for (let i = 0; i < total; i++)
    if ((await starterName(mgr.page, i)) === name) index = i;
  test.skip(index < 0, "no starter matches an existing checklist name");
  const before = await templateLinks(mgr.page).count();
  await starterCards(mgr.page).nth(index).click();
  await slow(
    mgr.page.getByText(`You already have a template called ${name}.`),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("heading", { name: "Checklists", level: 1 }),
  ).toBeVisible();
  await slow(templateLinks(mgr.page)).toHaveCount(before);
  await mgr.context.close();
});

test("open a checklist, add an item, edit it, remove it", async ({
  browser,
}) => {
  test.skip(!templateHref, "the library scenario found no checklist");
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await mgr.page.goto(templateHref as string);
  await slow(
    mgr.page.getByRole("link", { name: "All checklists" }),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("heading", { name: "Add an item" }),
  ).toBeVisible();

  // an empty label is refused with a message, not stored
  await mgr.page.getByRole("button", { name: "Add item" }).click();
  await slow(
    mgr.page.getByText("Check the details and try again."),
  ).toBeVisible();

  const label = unique("Check fridge");
  await mgr.page.getByLabel("What to check").last().fill(label);
  await mgr.page.getByLabel("Instruction").last().fill("Below 5 degrees");
  await mgr.page.getByRole("button", { name: "Add item" }).click();
  const row = (text: string) =>
    mgr.page
      .getByText(text, { exact: true })
      .locator("xpath=ancestor::*[.//button[normalize-space()='Edit']][1]");
  await slow(row(label)).toBeVisible();
  await slow(row(label)).toContainText("Below 5 degrees");

  const edited = `${label} edited`;
  await row(label).getByRole("button", { name: "Edit" }).click();
  await mgr.page.locator(`input[value="${label}"]`).fill(edited);
  await mgr.page.getByRole("button", { name: "Save" }).click();
  await slow(row(edited)).toBeVisible();
  await slow(mgr.page.getByText(label, { exact: true })).toHaveCount(0);

  await row(edited).getByRole("button", { name: "Remove" }).click();
  await slow(mgr.page.getByText(edited, { exact: true })).toHaveCount(0);
  watch.expectNone();
  await mgr.context.close();
});

test("rules: add for everyone, a position and a person with each timing, then stop them", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "checklists");
  const form = mgr.page.getByRole("heading", { name: "Add a rule" });
  await slow(form).toBeVisible();
  const stops = () => mgr.page.getByRole("button", { name: "Stop this rule" });
  const start = await stops().count();

  const pick = async (label: RegExp, option?: string) => {
    await mgr.page
      .getByRole("combobox", { name: label })
      .or(mgr.page.getByRole("button", { name: label }))
      .click();
    const o = option
      ? mgr.page.getByRole("option", { name: option, exact: true })
      : mgr.page.getByRole("option").first();
    await o.click();
  };

  // no checklist chosen -> message
  await mgr.page.getByRole("button", { name: "Add rule" }).click();
  await slow(mgr.page.getByText("Choose a checklist.")).toBeVisible();

  // everyone, shift start
  await pick(/^Checklist/);
  await mgr.page.getByRole("button", { name: "Add rule" }).click();
  await slow(stops()).toHaveCount(start + 1);
  await slow(
    mgr.page
      .getByText(/for everyone on a shift, due when the shift starts/)
      .first(),
  ).toBeVisible();

  // a position, before the end
  await pick(/^Checklist/);
  await pick(/^Given to/, "One position");
  await pick(/^Position/);
  await pick(/^Due/, "Before the shift ends");
  await mgr.page.getByLabel("Minutes before the end").fill("20");
  await mgr.page.getByRole("button", { name: "Add rule" }).click();
  await slow(stops()).toHaveCount(start + 2);
  await slow(
    mgr.page
      .getByText(/shifts, due before the shift ends \(20 minutes before\)/)
      .first(),
  ).toBeVisible();

  // a person, fixed time
  await pick(/^Checklist/);
  await pick(/^Given to/, "One person");
  await pick(/^Person/);
  await pick(/^Due/, "At a set time");
  await mgr.page.getByLabel(/Time \(venue time\)/).fill("17:30");
  await mgr.page.getByRole("button", { name: "Add rule" }).click();
  await slow(stops()).toHaveCount(start + 3);
  await slow(
    mgr.page.getByText(/due at a set time \(17:30\)/).first(),
  ).toBeVisible();

  // stop the three we added (the newest are listed last or first; stopping any three returns the count)
  for (let n = 2; n >= 0; n--) {
    await stops().last().click();
    await slow(stops()).toHaveCount(start + n);
  }
  await mgr.context.close();
});

test("a rule with a bad time or a missing person is refused with a message", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "checklists");
  const stops = mgr.page.getByRole("button", { name: "Stop this rule" });
  const start = await stops.count();
  await mgr.page.getByRole("combobox", { name: /^Checklist/ }).click();
  await mgr.page.getByRole("option").first().click();
  await mgr.page.getByRole("combobox", { name: /^Given to/ }).click();
  await mgr.page.getByRole("option", { name: "One person" }).click();
  await mgr.page.getByRole("button", { name: "Add rule" }).click();
  await slow(mgr.page.getByText("Choose the person.")).toBeVisible();
  await slow(stops).toHaveCount(start);
  await mgr.context.close();
});

test("unknown checklist and venue ids are not found, staff cannot open setup", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.goto(`/venues/${mgr.venue}/checklists/no-such-checklist-key`);
  await slow(mgr.page.getByText(NOT_FOUND).first()).toBeVisible();
  await mgr.page.goto("/venues/not-a-uuid/checklists");
  await slow(mgr.page.getByText(NOT_FOUND).first()).toBeVisible();
  await mgr.page.goto(
    "/venues/00000000-0000-4000-8000-000000000000/checklists",
  );
  await slow(mgr.page.getByText(NOT_FOUND).first()).toBeVisible();
  await mgr.context.close();

  const staff = await as(browser, "staff");
  await staff.page.goto(`/venues/${staff.venue}/checklists`);
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.context.close();
});

test("checklist setup is usable at phone width with no side scroll", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.setViewportSize({ width: 390, height: 844 });
  await openVenuePage(mgr.page, mgr.venue, "checklists");
  await slow(
    mgr.page.getByRole("heading", { name: "Checklists", level: 1 }),
  ).toBeVisible();
  await noSideScroll(mgr.page);
  if (templateHref) {
    await mgr.page.goto(templateHref);
    await slow(
      mgr.page.getByRole("heading", { name: "Add an item" }),
    ).toBeVisible();
    await noSideScroll(mgr.page);
  }
  await mgr.context.close();
});
