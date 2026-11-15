/** Helpers for the manager checklist and board specs: make a template and a list of our own. */
import { expect, type Page } from "@playwright/test";
import { unique } from "../support/live";

const slow = expect.configure({ timeout: 25_000 });
/** The demo's published roster week; Ana Silva has one shift in it. */
export const DEMO_WEEK = "2026-11-09";
export const PERSON = "Ana Silva";

export async function pick(page: Page, label: RegExp, option?: string) {
  await page
    .getByRole("combobox", { name: label })
    .or(page.getByRole("button", { name: label }))
    .first()
    .click();
  const o = option
    ? page.getByRole("option", { name: option, exact: true })
    : page.getByRole("option").first();
  await o.click();
}

/** Copy the first checklist under a new name. Ends on the new checklist's page. */
export async function copyFirstTemplate(page: Page, venue: string) {
  await page.goto(`/venues/${venue}/checklists`);
  await page.waitForLoadState("load");
  const first = page
    .locator('a[href*="/checklists/"]')
    .filter({ hasNotText: /All checklists|Issued lists/ })
    .first();
  await slow(first).toBeVisible();
  await first.click();
  await slow(
    page.getByRole("heading", { name: "Copy or retire" }),
  ).toBeVisible();
  await page.waitForLoadState("load");
  const name = unique("Own list");
  await page.getByLabel("Name for the copy").fill(name);
  await page.getByRole("button", { name: "Make a copy" }).click();
  await slow(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await page.waitForLoadState("load");
  return name;
}

/** A rule giving the checklist to Ana Silva when her shift starts. */
export async function addRuleForPerson(
  page: Page,
  venue: string,
  name: string,
) {
  await page.goto(`/venues/${venue}/checklists`);
  await page.waitForLoadState("load");
  await slow(page.getByRole("heading", { name: "Add a rule" })).toBeVisible();
  await pick(page, /^Checklist/, name);
  await pick(page, /^Given to/, "One person");
  await pick(page, /^Person/, PERSON);
  await page.getByRole("button", { name: "Add rule" }).click();
  await slow(
    page.getByText(
      new RegExp(`^${name} for ${PERSON}, due when the shift starts`),
    ),
  ).toBeVisible();
}

export async function stopRule(page: Page, venue: string, name: string) {
  await page.goto(`/venues/${venue}/checklists`);
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: "Stop this rule" }).last().click();
  await slow(page.getByText(new RegExp(`^${name} for `))).toHaveCount(0);
}

/** Issue the demo week's lists, then open our own list from the issued page. Returns the list's address. */
export async function issueAndOpen(page: Page, venue: string, name: string) {
  await page.goto(`/venues/${venue}/checklists/issued`);
  await page.waitForLoadState("load");
  await slow(
    page.getByRole("heading", { name: "Issue lists now" }),
  ).toBeVisible();
  await page.getByLabel("Week starting (a Monday)").fill(DEMO_WEEK);
  await page.getByRole("button", { name: "Issue lists now" }).click();
  await slow(page.getByText(/^Made \d+ new lists?/)).toBeVisible();
  await page.goto(
    `/venues/${venue}/checklists/issued?from=${DEMO_WEEK}&to=2026-11-15`,
  );
  const link = page.getByRole("link", {
    name: new RegExp(`^${name}, ${PERSON}`),
  });
  await slow(link.first()).toBeVisible();
  await link.first().click();
  await slow(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await page.waitForLoadState("load");
  return page.url();
}

/** A template, a rule for Ana, an issued list: returns what the spec needs. */
export async function makeOwnList(page: Page, venue: string) {
  const name = await copyFirstTemplate(page, venue);
  await addRuleForPerson(page, venue, name);
  const listUrl = await issueAndOpen(page, venue, name);
  await stopRule(page, venue, name);
  return { name, listUrl };
}

/** A tiny real PNG. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
