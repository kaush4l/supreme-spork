import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";
import {
  copyFirstTemplate,
  DEMO_WEEK,
  makeOwnList,
  pick,
  stopRule,
} from "./manager-checklist-helpers";
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
    .filter({ hasNotText: /All checklists|Issued lists/ });

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

test("make a copy of a checklist (a double click writes once), then retire it after being asked", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  const name = await copyFirstTemplate(mgr.page, mgr.venue);
  // a second copy under the same name is refused with the API's sentence
  await mgr.page.getByLabel("Name for the copy").fill(name);
  await mgr.page.getByRole("button", { name: "Make a copy" }).click();
  await slow(
    mgr.page.getByText(`You already have a template called ${name}.`),
  ).toBeVisible();

  // a double click on "Make a copy" makes one copy
  const twice = unique("Twice copy");
  await mgr.page.getByLabel("Name for the copy").fill(twice);
  await mgr.page.getByRole("button", { name: "Make a copy" }).dblclick();
  await slow(
    mgr.page.getByRole("heading", { name: twice, level: 1 }),
  ).toBeVisible();
  await openVenuePage(mgr.page, mgr.venue, "checklists");
  await slow(
    mgr.page.getByRole("link", { name: new RegExp(`^${twice}`) }),
  ).toHaveCount(1);

  // retire asks first, and says what it does to lists already issued
  await mgr.page.getByRole("link", { name: new RegExp(`^${twice}`) }).click();
  await mgr.page.waitForLoadState("load");
  await mgr.page.getByRole("button", { name: "Retire" }).click();
  await slow(mgr.page.getByText("Retire this checklist?")).toBeVisible();
  await slow(
    mgr.page.getByText(/Lists already issued from it stay as they are/),
  ).toBeVisible();
  await mgr.page.getByRole("button", { name: "No, keep it" }).click();
  await slow(mgr.page.getByText("Retire this checklist?")).toHaveCount(0);
  await mgr.page.getByRole("button", { name: "Retire" }).click();
  await mgr.page.getByRole("button", { name: "Yes, retire it" }).click();
  await slow(
    mgr.page.getByRole("heading", { name: "Checklists", level: 1 }),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("link", { name: new RegExp(`^${twice}`) }),
  ).toHaveCount(0);

  // clean up the first copy too
  await mgr.page.getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await mgr.page.waitForLoadState("load");
  await mgr.page.getByRole("button", { name: "Retire" }).click();
  await mgr.page.getByRole("button", { name: "Yes, retire it" }).click();
  await slow(
    mgr.page.getByRole("link", { name: new RegExp(`^${name}`) }),
  ).toHaveCount(0);
  watch.expectNone();
  await mgr.context.close();
});

test("edit a rule: who it goes to and when", async ({ browser }) => {
  const mgr = await as(browser, "manager");
  const name = await copyFirstTemplate(mgr.page, mgr.venue);
  await openVenuePage(mgr.page, mgr.venue, "checklists");
  await pick(mgr.page, /^Checklist/, name);
  await mgr.page.getByRole("button", { name: "Add rule" }).click();
  const said = (rest: RegExp) =>
    mgr.page.getByText(new RegExp(`^${name} for .*${rest.source}`));
  const change = () =>
    mgr.page.getByRole("button", { name: "Change this rule" }).last();
  await slow(
    said(/everyone on a shift, due when the shift starts/),
  ).toBeVisible();

  await change().click();
  await mgr.page
    .getByRole("combobox", { name: /^Due/ })
    .or(mgr.page.getByRole("button", { name: /^Due/ }))
    .first()
    .click();
  await mgr.page.getByRole("option", { name: "At a set time" }).click();
  await mgr.page
    .getByLabel(/Time \(venue time\)/)
    .last()
    .fill("17:30");
  await mgr.page.getByRole("button", { name: "Save rule" }).click();
  await slow(mgr.page.getByRole("button", { name: "Save rule" })).toHaveCount(
    0,
  );
  await slow(said(/due at a set time \(17:30\)/)).toBeVisible();

  // a bad time is refused with the API's sentence and the rule is unchanged
  await change().click();
  await mgr.page
    .getByLabel(/Time \(venue time\)/)
    .last()
    .fill("late");
  await mgr.page.getByRole("button", { name: "Save rule" }).click();
  await slow(mgr.page.getByText("Use a time like 21:30.")).toBeVisible();
  await mgr.page.getByRole("button", { name: "Cancel" }).click();

  // change who it goes to: one position
  await change().click();
  await mgr.page
    .getByRole("combobox", { name: /^Given to/ })
    .or(mgr.page.getByRole("button", { name: /^Given to/ }))
    .first()
    .click();
  await mgr.page.getByRole("option", { name: "One position" }).click();
  await mgr.page
    .getByRole("combobox", { name: /^Position/ })
    .or(mgr.page.getByRole("button", { name: /^Position/ }))
    .first()
    .click();
  await mgr.page.getByRole("option").first().click();
  await mgr.page.getByRole("button", { name: "Save rule" }).click();
  await slow(mgr.page.getByRole("button", { name: "Save rule" })).toHaveCount(
    0,
  );
  await slow(said(/shifts, due at a set time \(17:30\)/)).toBeVisible();

  await stopRule(mgr.page, mgr.venue, name);
  await mgr.page.goto(`/venues/${mgr.venue}/checklists`);
  await mgr.page.getByRole("link", { name: new RegExp(`^${name}`) }).click();
  await mgr.page.waitForLoadState("load");
  await mgr.page.getByRole("button", { name: "Retire" }).click();
  await mgr.page.getByRole("button", { name: "Yes, retire it" }).click();
  await slow(
    mgr.page.getByRole("link", { name: new RegExp(`^${name}`) }),
  ).toHaveCount(0);
  await mgr.context.close();
});

test("issued lists by date: issue now, repeat adds nothing, my list is there and links to its page", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "checklists");
  await mgr.page.getByRole("link", { name: "Issued lists, by date" }).click();
  await slow(
    mgr.page.getByRole("heading", { name: "Issued lists", level: 1 }),
  ).toBeVisible();
  await slow(mgr.page.getByText(/\d+ lists? in all/)).toBeVisible();

  const { name, listUrl } = await makeOwnList(mgr.page, mgr.venue);
  expect(listUrl).toMatch(/\/board\/[0-9a-f-]{36}$/);

  // issuing again makes nothing new, and a double click answers once
  await mgr.page.goto(`/venues/${mgr.venue}/checklists/issued`);
  await mgr.page.waitForLoadState("load");
  await mgr.page.getByLabel("Week starting (a Monday)").fill(DEMO_WEEK);
  await mgr.page.getByRole("button", { name: "Issue lists now" }).dblclick();
  await slow(
    mgr.page.getByText(/^Made 0 new lists for the week starting 2026-11-09/),
  ).toBeVisible();
  await slow(mgr.page.getByText(/^Made /)).toHaveCount(1);

  // the date range form narrows the list; an empty range says so
  await mgr.page.getByLabel("From", { exact: true }).fill(DEMO_WEEK);
  await mgr.page.getByLabel("To", { exact: true }).fill("2026-11-15");
  await mgr.page.getByRole("button", { name: "Show" }).click();
  await expect(mgr.page).toHaveURL(/issued\?from=2026-11-09&to=2026-11-15/);
  await slow(
    mgr.page.getByText(/\d+ lists? from 2026-11-09 to 2026-11-15/),
  ).toBeVisible();
  await slow(
    mgr.page.getByRole("link", { name: new RegExp(`^${name}, `) }),
  ).toHaveCount(1);
  await slow(
    mgr.page.getByText(/^Due \d{1,2}:\d{2} [ap]m$/).first(),
  ).toBeVisible();
  await mgr.page.getByLabel("From", { exact: true }).fill("2030-01-01");
  await mgr.page.getByLabel("To", { exact: true }).fill("2030-01-07");
  await mgr.page.getByRole("button", { name: "Show" }).click();
  await slow(
    mgr.page.getByText(
      "No lists were issued between 2030-01-01 and 2030-01-07.",
    ),
  ).toBeVisible();
  await mgr.page.getByLabel("From", { exact: true }).fill("2030-02-01");
  await mgr.page.getByLabel("To", { exact: true }).fill("2030-01-07");
  await mgr.page.getByRole("button", { name: "Show" }).click();
  await slow(
    mgr.page.getByText("The end date is before the start date."),
  ).toBeVisible();

  // a day that is not a Monday is refused with the API's sentence
  await mgr.page.getByLabel("Week starting (a Monday)").fill("2026-11-10");
  await mgr.page.getByRole("button", { name: "Issue lists now" }).click();
  await slow(
    mgr.page.getByText("A roster week starts on a Monday."),
  ).toBeVisible();
  watch.expectNone();
  await mgr.context.close();
});

test("issued lists: empty on the owner's second venue, hidden from staff, fine at phone width", async ({
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
  await owner.page.goto(`/venues/${bondi}/checklists/issued`);
  await slow(
    owner.page.getByRole("heading", { name: "Issued lists", level: 1 }),
  ).toBeVisible();
  await slow(owner.page.getByText("No lists were issued yet.")).toBeVisible();
  await owner.context.close();

  const mgr = await as(browser, "manager");
  await mgr.page.setViewportSize({ width: 390, height: 844 });
  await mgr.page.goto(
    `/venues/${mgr.venue}/checklists/issued?from=${DEMO_WEEK}&to=2026-11-15`,
  );
  await slow(
    mgr.page.getByRole("heading", { name: "Issued lists", level: 1 }),
  ).toBeVisible();
  await noSideScroll(mgr.page);
  await mgr.context.close();

  const staff = await as(browser, "staff");
  await staff.page.goto(`/venues/${staff.venue}/checklists/issued`);
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.context.close();
});
