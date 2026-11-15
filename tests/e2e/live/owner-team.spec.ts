import { type Page, test } from "@playwright/test";
import { signIn, skipUnlessLive, unique } from "../support/live";
import {
  demoVenue,
  errorBanner,
  expect,
  expectNoSideScroll,
  mailTo,
  open,
  personCard,
  watch,
} from "./owner-support";

skipUnlessLive();

const addForm = (page: Page) =>
  page.getByRole("heading", { name: "Add a person" }).locator("xpath=..");
const positionsCard = (page: Page) =>
  page
    .getByRole("heading", { name: "Positions", exact: true })
    .locator("xpath=..");

let errs: ReturnType<typeof watch>;
test.beforeEach(({ page }) => {
  errs = watch(page);
});
test.afterEach(() => errs.expectNone());

test.describe("team, as the owner", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  const stamp = unique("T").replace(/\W/g, "").toLowerCase();
  const position = unique("Pos");
  const person = unique("Tess");
  const renamed = `${person} B`;
  const email = `team.${stamp}@example.com`;
  let venue: string;

  test.beforeEach(async ({ page }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
    await open(page, venue, "team");
  });

  test("lists the people with their pay and who can sign in", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Team", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Working here" }),
    ).toBeVisible();
    const priya = personCard(page, "Priya Nair");
    await expect(priya).toContainText("Can sign in");
    await expect(priya).toContainText("demo.staff@example.com");
    await expect(priya).toContainText(/\$\d+\.\d\d an hour/);
    await expect(page.getByRole("heading", { name: "Invites" })).toBeVisible();
  });

  test("adds a position, and a duplicate name does not make a second one", async ({
    page,
  }) => {
    const card = positionsCard(page);
    await card.getByLabel("New position").fill(position);
    await card.getByLabel(/Default rate/).fill("21.50");
    await card.getByRole("button", { name: "Add position" }).click();
    await expect(card.getByText(`${position} · $21.50 an hour`)).toBeVisible();

    await card.getByLabel("New position").fill(position);
    await card.getByRole("button", { name: "Add position" }).click();
    // Either a plain refusal or an unchanged list; never a crash message.
    await expect(async () => {
      const refused = await errorBanner(page).count();
      const text = refused ? await errorBanner(page).first().innerText() : "";
      expect(text).not.toMatch(/\b(500|undefined|exception|traceback)\b/i);
      expect(
        refused > 0 ||
          (await card.getByLabel("New position").inputValue()) === "",
      ).toBe(true);
    }).toPass();
    await page.reload();
    await expect(
      positionsCard(page).getByText(`${position} · $21.50 an hour`),
    ).toHaveCount(1);
    await expect(
      positionsCard(page).getByText(new RegExp(`^${position} ·`)),
    ).toHaveCount(1);
  });

  test("adds a person, rate in dollars becomes cents, and they show in the list", async ({
    page,
  }) => {
    const form = addForm(page);
    await form.getByLabel("Name").fill(person);
    await form.getByLabel("Email").fill(email);
    await form.getByLabel(/Pay rate/).fill("27.50");
    await form.getByLabel(position).check();
    await form.getByRole("button", { name: "Add person" }).click();
    const card = personCard(page, person);
    await expect(card).toBeVisible();
    await expect(card).toContainText(email);
    await expect(card).toContainText(position);
    await expect(card).toContainText("$27.50 an hour");
    await expect(card).toContainText("No login yet");
    await expect(form.getByLabel("Name")).toHaveValue("");
  });

  test("refuses a missing name, a bad email and a bad rate with a plain message", async ({
    page,
  }) => {
    const form = addForm(page);
    const add = form.getByRole("button", { name: "Add person" });
    await expect(add).toBeDisabled(); // no name yet
    await form.getByLabel("Name").fill("   ");
    await expect(add).toBeDisabled();

    const bad = unique("Bad");
    await form.getByLabel("Name").fill(bad);
    for (const rate of ["-5", "abc", "12.345", "1e3"]) {
      await form.getByLabel(/Pay rate/).fill(rate);
      await add.click();
      await expect(errorBanner(page).first()).toContainText(
        "Type the pay rate as dollars",
      );
    }
    await form.getByLabel(/Pay rate/).fill("");
    await form.getByLabel("Email").fill("not-an-email");
    await add.click();
    await expect(errorBanner(page).first()).toBeVisible();
    await expect(errorBanner(page).first()).not.toContainText(
      /\b(500|undefined|exception|422)\b/i,
    );
    await page.reload();
    await expect(page.getByText(bad, { exact: true })).toHaveCount(0);
  });

  test("invites a person: shows as waiting, and can be cancelled", async ({
    page,
  }) => {
    const card = personCard(page, person);
    await card.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(
      card.getByText(`We emailed an invite to ${email}.`),
    ).toBeVisible();
    await page.reload();
    const invites = page
      .getByRole("heading", { name: "Invites" })
      .locator("xpath=..");
    const line = invites
      .locator("div")
      .filter({ hasText: email })
      .filter({ has: page.getByRole("button", { name: "Cancel invite" }) })
      .last();
    await expect(line).toContainText("Waiting");
    await expect(line).toContainText("Staff");
    await line.getByRole("button", { name: "Cancel invite" }).click();
    await expect(invites.getByText(email)).toHaveCount(0);
  });

  // The backend only sends mail when SMTP_HOST is set; the demo stack leaves it unset (the mail is printed to the
  // backend log) and also holds mail during the venue's quiet hours, so Mailpit stays empty. Run with E2E_MAIL=1 on a
  // stack whose backend sends to Mailpit.
  test("the invite email arrives in Mailpit with a link and no pay figure", async ({
    page,
  }) => {
    test.fixme(
      !process.env.E2E_MAIL,
      "demo backend has no SMTP_HOST, so invite mail never reaches Mailpit",
    );
    const card = personCard(page, person);
    await card.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(
      card.getByText(`We emailed an invite to ${email}.`),
    ).toBeVisible();
    const mail = await mailTo(page, email);
    const body = `${mail.text}\n${mail.html}`;
    expect(body).toMatch(/https?:\/\/\S+/);
    expect(body).not.toMatch(/27\.50|2750|\$\s?\d/);
    expect(mail.subject).not.toMatch(/\$\s?\d/);
  });

  test("edits a person", async ({ page }) => {
    const card = personCard(page, person);
    await card.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(card.getByLabel("Name")).toHaveValue(person);
    await expect(card.getByLabel(/Pay rate/)).toHaveValue("27.50");
    await card.getByLabel("Name").fill(renamed);
    await card.getByLabel(/Pay rate/).fill("30");
    await card.getByRole("button", { name: "Save changes" }).click();
    const after = personCard(page, renamed);
    await expect(after).toBeVisible();
    await expect(after).toContainText("$30.00 an hour");
    await expect(page.getByText(person, { exact: true })).toHaveCount(0);
  });

  test("ends employment after a confirm, then restores", async ({ page }) => {
    const card = personCard(page, renamed);
    // Backing out of the dialog changes nothing.
    await card.getByRole("button", { name: "End employment" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`End ${renamed}'s employment?`);
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
    await expect(card.getByText("Working here").first()).toBeVisible();

    await card.getByRole("button", { name: "End employment" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "End employment" })
      .click();
    const left = page.getByRole("heading", { name: "Left", exact: true });
    await expect(left).toBeVisible();
    const gone = personCard(page, renamed);
    await expect(gone).toContainText("Left");
    await expect(gone).toContainText("Last day");

    await gone.getByRole("button", { name: "Restore" }).click();
    await expect(
      personCard(page, renamed).getByText("Working here").first(),
    ).toBeVisible();
    await expect(personCard(page, renamed)).not.toContainText("Last day");
  });

  test("second-factor reset: only for a person with a login, behind a confirm, never for yourself", async ({
    page,
  }) => {
    // A person without a login has no reset button.
    await expect(
      personCard(page, renamed).getByRole("button", { name: /second factor/i }),
    ).toHaveCount(0);
    // The owner has no staff card of their own, so there is no button to reset yourself with.
    await expect(page.getByText("demo.owner@example.com")).toHaveCount(0);

    const priya = personCard(page, "Priya Nair");
    await priya
      .getByRole("button", { name: "Reset their second factor" })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Reset Priya Nair's second factor?");
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).toBeHidden();
    await expect(
      priya.getByText("Their second factor was removed."),
    ).toHaveCount(0);

    await priya
      .getByRole("button", { name: "Reset their second factor" })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Reset", exact: true })
      .click();
    await expect(
      priya.getByText("Their second factor was removed."),
    ).toBeVisible();
    await expect(errorBanner(page)).toHaveCount(0);
  });

  test("works at phone width with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, venue, "team");
    await expect(
      page.getByRole("heading", { name: "Team", level: 1 }),
    ).toBeVisible();
    await expect(
      addForm(page).getByRole("button", { name: "Add person" }),
    ).toBeVisible();
    await expectNoSideScroll(page);
  });

  test("an unknown venue or a bad id shows not-found", async ({ page }) => {
    const unknown = await page.goto(
      "/venues/00000000-0000-4000-8000-000000000000/team",
    );
    expect(unknown?.status()).toBe(404);
    const bad = await page.goto("/venues/not-a-uuid/team");
    expect(bad?.status()).toBe(404);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });
});

test.describe("team, as other roles", () => {
  test.describe.configure({ timeout: 120_000 });
  test("a manager sees the team but not the owner pages or the second-factor reset", async ({
    page,
  }) => {
    await signIn(page, "manager");
    const venue = await demoVenue(page);
    await open(page, venue, "team");
    await expect(
      page.getByRole("heading", { name: "Team", level: 1 }),
    ).toBeVisible();
    await expect(personCard(page, "Priya Nair")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /second factor/i }),
    ).toHaveCount(0);
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Team" })).toBeVisible();
    // Change requests is in a manager's menu too (their own asks); Settings and the rules are the owner's.
    for (const hidden of ["Settings", "Who can do what"])
      await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
    // The owner's rules page is not for a manager.
  });

  test("a manager gets not-found on the owner's rules page", async ({
    page,
  }) => {
    await signIn(page, "manager");
    const venue = await demoVenue(page);
    const rules = await page.goto(`/venues/${venue}/rules`);
    expect(rules?.status()).toBe(404);
  });

  test("a staff member cannot open the team page", async ({ page }) => {
    await signIn(page, "staff");
    const venue = await demoVenue(page);
    await page.goto(`/venues/${venue}/team`);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Add a person" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Team" }),
    ).toHaveCount(0);
  });
});
