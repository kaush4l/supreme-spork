import { type Browser, type Page, test } from "@playwright/test";
import { signIn, skipUnlessLive, unique } from "../support/live";
import {
  demoVenue,
  errorBanner,
  expect,
  expectNoSideScroll,
  open,
  personCard,
  watch,
} from "./owner-support";

skipUnlessLive();

let errs: ReturnType<typeof watch>;
test.beforeEach(({ page }) => {
  errs = watch(page);
});
test.afterEach(() => errs.expectNone());

const approvalGroup = (page: Page, right: string) =>
  page.getByRole("radiogroup", { name: right });
async function chooseApproval(page: Page, right: string, level: string) {
  await approvalGroup(page, right).getByText(level, { exact: true }).click();
  await expect(
    approvalGroup(page, right).getByRole("radio", { name: level }),
  ).toBeChecked();
  await expect(errorBanner(page)).toHaveCount(0);
}

/** A request card on the changes page, found by the person's name in its sentence and the button it must have. */
const request = (page: Page, name: string, button: string) =>
  page
    .locator("div")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("button", { name: button, exact: true }) })
    .last();
/** Any card (decided or not) that mentions the person. */
const anyRequest = (page: Page, name: string) =>
  page
    .locator("div")
    .filter({ hasText: name })
    .filter({ has: page.getByText(/^Asked by /) })
    .last();

async function addPerson(page: Page, name: string, rate: string) {
  const form = page
    .getByRole("heading", { name: "Add a person" })
    .locator("xpath=..");
  await form.getByLabel("Name").fill(name);
  await form.getByLabel(/Pay rate/).fill(rate);
  await form.getByRole("button", { name: "Add person" }).click();
  await expect(personCard(page, name)).toBeVisible();
}

/** The manager asks for a new pay rate for a person (the owner's approval rule is on). */
async function askForPay(page: Page, name: string, rate: string) {
  const card = personCard(page, name);
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await card.getByLabel(/Pay rate/).fill(rate);
  await card.getByRole("button", { name: "Save changes" }).click();
  return card;
}

test.describe("change requests, from ask to decision", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  const run = unique("Chg").replace(/\W/g, "");
  const names = {
    approve: `Appro ${run}`,
    reject: `Rejec ${run}`,
    withdraw: `Withd ${run}`,
    twice: `Twice ${run}`,
  };
  let venue: string;

  async function restore(browser: Browser) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await signIn(page, "owner");
      const v = await demoVenue(page);
      await open(page, v, "rules");
      const group = approvalGroup(page, "Change someone's pay");
      if (
        !(await group.getByRole("radio", { name: "No approval" }).isChecked())
      ) {
        await group.getByText("No approval", { exact: true }).click();
        await expect(
          group.getByRole("radio", { name: "No approval" }),
        ).toBeChecked();
      }
      await open(page, v, "team");
      for (const name of Object.values(names)) {
        const card = personCard(page, name);
        if ((await card.count()) === 0) continue;
        const end = card.getByRole("button", { name: "End employment" });
        if ((await end.count()) === 0) continue;
        await end.click();
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: "End employment" })
          .click();
        await expect(personCard(page, name)).toContainText("Last day");
      }
    } finally {
      await ctx.close();
    }
  }
  test.afterAll(async ({ browser }) => {
    await restore(browser);
  });

  test("owner sets pay changes to need approval, and adds four people to test with", async ({
    page,
  }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
    await open(page, venue, "rules");
    await chooseApproval(page, "Change someone's pay", "Owner approves");
    await open(page, venue, "rules");
    await expect(
      approvalGroup(page, "Change someone's pay").getByRole("radio", {
        name: "Owner approves",
      }),
    ).toBeChecked();
    await open(page, venue, "team");
    for (const name of Object.values(names)) await addPerson(page, name, "20");
  });

  test("a manager's pay changes wait for approval; asking again is refused; withdraw works", async ({
    page,
  }) => {
    await signIn(page, "manager");
    venue = await demoVenue(page);
    await open(page, venue, "team");

    for (const [name, rate] of [
      [names.approve, "21"],
      [names.reject, "22"],
      [names.withdraw, "23"],
      [names.twice, "24"],
    ] as const) {
      const card = await askForPay(page, name, rate);
      await expect(card.getByText(/Sent for approval/)).toBeVisible();
    }
    // Nothing changed yet.
    await page.reload();
    await expect(personCard(page, names.approve)).toContainText(
      "$20.00 an hour",
    );

    // The same ask a second time gets a plain refusal.
    const again = await askForPay(page, names.approve, "21");
    await expect(errorBanner(page).first()).toBeVisible();
    await expect(errorBanner(page).first()).not.toContainText(
      /\b(500|undefined|exception|traceback)\b/i,
    );
    expect(again).toBeTruthy();

    // The manager's own inbox: the requests are "yours", with Withdraw and no Approve.
    await open(page, venue, "changes");
    await expect(
      page.getByRole("heading", { name: "Waiting for approval" }),
    ).toBeVisible();
    const mine = request(page, names.withdraw, "Withdraw");
    await expect(mine).toContainText("Asked by you");
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await mine.getByRole("button", { name: "Withdraw", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Earlier" })).toBeVisible();
    await expect(anyRequest(page, names.withdraw)).toContainText(/withdrawn/i);
    // A withdrawn request cannot be decided by anyone, so no buttons remain on it.
    await expect(
      anyRequest(page, names.withdraw).getByRole("button"),
    ).toHaveCount(0);
  });

  test("the owner sees them as from a team member, approves one and rejects another", async ({
    page,
  }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
    await open(page, venue, "changes");
    const a = request(page, names.approve, "Approve");
    await expect(a).toContainText("Asked by a team member");
    await expect(a).not.toContainText("Asked by you");
    await expect(a.getByRole("button", { name: "Reject" })).toBeVisible();
    await expect(anyRequest(page, names.withdraw)).toContainText(/withdrawn/i);

    await a.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(anyRequest(page, names.approve)).toContainText(
      /applied|approved/i,
    );

    const r = request(page, names.reject, "Reject");
    await r.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(anyRequest(page, names.reject)).toContainText(/reject/i);

    // The approved change happened; the rejected one did not.
    await open(page, venue, "team");
    await expect(personCard(page, names.approve)).toContainText(
      "$21.00 an hour",
    );
    await expect(personCard(page, names.reject)).toContainText(
      "$20.00 an hour",
    );
    await expect(personCard(page, names.withdraw)).toContainText(
      "$20.00 an hour",
    );
  });

  test("deciding the same request twice shows a plain message", async ({
    page,
    context,
  }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
    await open(page, venue, "changes");
    await expect(request(page, names.twice, "Approve")).toBeVisible();
    // A second tab decides it first; this tab still shows the old card.
    const other = await context.newPage();
    await open(other, venue, "changes");
    await request(other, names.twice, "Reject")
      .getByRole("button", { name: "Reject", exact: true })
      .click();
    await expect(anyRequest(other, names.twice)).toContainText(/reject/i);
    await other.close();

    await request(page, names.twice, "Approve")
      .getByRole("button", { name: "Approve", exact: true })
      .click();
    const banner = errorBanner(page).first();
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText(
      /\b(409|500|undefined|already_decided|exception)\b/i,
    );
  });

  test("a manager with everything decided sees the empty state; staff get not-found", async ({
    page,
    browser,
  }) => {
    await signIn(page, "manager");
    venue = await demoVenue(page);
    await open(page, venue, "changes");
    await expect(page.getByText("Nothing is waiting.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Approve|Reject|Withdraw/ }),
    ).toHaveCount(0);
    // The earlier requests stay visible as history, as "you".
    await expect(page.getByRole("heading", { name: "Earlier" })).toBeVisible();
    await expect(anyRequest(page, names.withdraw)).toContainText(
      "Asked by you",
    );

    const ctx = await browser.newContext();
    const staff = await ctx.newPage();
    await signIn(staff, "staff");
    await open(staff, venue, "changes");
    await expect(staff.getByText(/could not be found/i)).toBeVisible();
    await expect(staff.getByText("Waiting for approval")).toHaveCount(0);
    await ctx.close();
  });

  test("works at phone width with no sideways scroll", async ({ page }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, venue, "changes");
    await expect(
      page.getByRole("heading", { name: "Change requests", level: 1 }),
    ).toBeVisible();
    await expect(anyRequest(page, names.twice)).toBeVisible();
    await expectNoSideScroll(page);
  });

  test("an unknown venue or a bad id shows not-found", async ({ page }) => {
    await signIn(page, "owner");
    const unknown = await page.goto(
      "/venues/00000000-0000-4000-8000-000000000000/changes",
    );
    expect(unknown?.status()).toBe(404);
    const bad = await page.goto("/venues/not-a-uuid/changes");
    expect(bad?.status()).toBe(404);
  });
});

test.describe("who can do what", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  let venue: string;

  test.beforeEach(async ({ page }) => {
    await signIn(page, "owner");
    venue = await demoVenue(page);
    await open(page, venue, "rules");
  });

  test("the rights and the approval rules load for the owner", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Who can do what", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Staff and pay" }),
    ).toBeVisible();
    await expect(
      page.getByText("Manage the staff list", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What needs approval" }),
    ).toBeVisible();
    await expect(approvalGroup(page, "Change someone's pay")).toBeVisible();
    await expect(page.getByText(/Your own approval limit: \$/)).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Manager: Manage the staff list" }),
    ).toBeEnabled();
  });

  test("changing who approves a right is saved, then put back", async ({
    page,
  }) => {
    const right = "Record and check certificates";
    try {
      await chooseApproval(page, right, "Owner approves");
      await open(page, venue, "rules");
      await expect(
        approvalGroup(page, right).getByRole("radio", {
          name: "Owner approves",
        }),
      ).toBeChecked();
    } finally {
      await open(page, venue, "rules");
      await chooseApproval(page, right, "No approval");
      await open(page, venue, "rules");
      await expect(
        approvalGroup(page, right).getByRole("radio", { name: "No approval" }),
      ).toBeChecked();
    }
  });

  test("a role's right can be switched and is saved, then put back", async ({
    page,
  }) => {
    const sw = () =>
      page.getByRole("switch", { name: "Bookkeeper: Change your own pay" });
    const was = await sw().isChecked();
    try {
      await sw().click();
      await expect(errorBanner(page)).toHaveCount(0);
      await open(page, venue, "rules");
      if (was) await expect(sw()).not.toBeChecked();
      else await expect(sw()).toBeChecked();
    } finally {
      await open(page, venue, "rules");
      if ((await sw().isChecked()) !== was) await sw().click();
      await expect(errorBanner(page)).toHaveCount(0);
      await open(page, venue, "rules");
      if (was) await expect(sw()).toBeChecked();
      else await expect(sw()).not.toBeChecked();
    }
  });

  test("works at phone width with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, venue, "rules");
    await expect(
      page.getByRole("heading", { name: "Who can do what", level: 1 }),
    ).toBeVisible();
    await expectNoSideScroll(page);
  });

  test("an unknown venue or a bad id shows not-found", async ({ page }) => {
    const unknown = await page.goto(
      "/venues/00000000-0000-4000-8000-000000000000/rules",
    );
    expect(unknown?.status()).toBe(404);
    const bad = await page.goto("/venues/not-a-uuid/rules");
    expect(bad?.status()).toBe(404);
  });
});

test.describe("who can do what, as other roles", () => {
  test.describe.configure({ timeout: 120_000 });
  for (const role of ["manager", "bookkeeper", "staff"] as const) {
    test(`${role} gets not-found`, async ({ page }) => {
      await signIn(page, role);
      const venue = await demoVenue(page);
      const r = await page.goto(`/venues/${venue}/rules`);
      expect(r?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { name: "What needs approval" }),
      ).toHaveCount(0);
    });
  }

  test("a partner can read the rules but not change them", async ({ page }) => {
    await signIn(page, "partner");
    const venue = await demoVenue(page);
    await open(page, venue, "rules");
    await expect(
      page.getByText("Only the owner can change these.").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Manager: Manage the staff list" }),
    ).toBeDisabled();
  });
});
