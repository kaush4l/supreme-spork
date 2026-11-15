import { expect, type Page, test } from "@playwright/test";
import { openVenuePage, signIn, skipUnlessLive, unique } from "../support/live";
import {
  api,
  cancelShift,
  listForShift,
  makeShift,
  must,
  venuePath,
} from "../support/staff-api";

skipUnlessLive();
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);
const expectSoon = expect.configure({ timeout: 20_000 });

const TICK_1 = "Food covered, labelled and put away";
const TEMP = "Fridge temperature in C";
const TICK_2 = "Till cashed up";
const PHOTO = "Photo of the clean kitchen";
const TICK_3 = "Bins out, doors and windows locked, alarm set";
const NOTE = "Handover note";

/** The smallest block that holds this item's label and one of its controls. */
const card = (page: Page, label: string) =>
  page
    .locator("div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .filter({ has: page.locator("button, input, textarea, [role=switch]") })
    .last();

/** A fresh closing checklist for Priya (made by publishing a shift for her). */
async function freshList() {
  // one closing list is issued per person per day, so each run takes a day nobody used before
  const shift = await makeShift({
    dayOffset: 20 + Math.floor(Math.random() * 3000),
    hour: 10, // a daytime shift: its closing list is issued for the same day (a shift before 4 am belongs to the day before)
  });
  const listId = await listForShift(shift.id, shift.day);
  return { shift, listId };
}

async function openList(page: Page, listId: string) {
  const id = await signIn(page, "staff");
  await openVenuePage(page, id, `lists/${listId}`);
  await expectSoon(
    page.getByRole("heading", { name: "Closing", level: 1 }),
  ).toBeVisible();
  return id;
}

/** Type a reading into the number field of an item card. */
async function fillNumber(item: ReturnType<typeof card>, value: string) {
  const box = item.getByRole("spinbutton");
  await box.fill(value);
  await box.press("Tab");
}

async function jpeg(page: Page): Promise<Buffer> {
  const url = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 48;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#3a7";
      g.fillRect(0, 0, 64, 48);
    }
    return c.toDataURL("image/jpeg", 0.8);
  });
  return Buffer.from(url.split(",")[1], "base64");
}

test("the list page opens with its items, status and progress", async ({
  page,
}) => {
  const { shift, listId } = await freshList();
  try {
    await openList(page, listId);
    await expectSoon(
      page.getByText("To do", { exact: true }).first(),
    ).toBeVisible();
    await expectSoon(page.getByText(/^Due /)).toBeVisible();
    await expectSoon(
      page.getByText("0 of 6 done, 0 of 5 required"),
    ).toBeVisible();
    for (const label of [TICK_1, TEMP, TICK_2, PHOTO, TICK_3, NOTE])
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText("Expected: 0 to 5")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finish list" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "All my checklists" }),
    ).toBeVisible();
  } finally {
    await cancelShift(shift.id);
  }
});

test("tick, number in and out of range, note, not applicable and an added item", async ({
  page,
}) => {
  const { shift, listId } = await freshList();
  try {
    await openList(page, listId);

    // tick
    await card(page, TICK_1).getByRole("switch").click();
    await expectSoon(
      page.getByText("1 of 6 done, 1 of 5 required"),
    ).toBeVisible();
    await expectSoon(
      card(page, TICK_1).getByText("Done", { exact: true }),
    ).toBeVisible();

    // a number inside the range: saved, no warning
    const temp = card(page, TEMP);
    await fillNumber(temp, "3");
    await temp.getByRole("button", { name: "Save reading" }).click();
    await expectSoon(
      page.getByText("2 of 6 done, 2 of 5 required"),
    ).toBeVisible();
    await expect(page.getByText(/Outside 0 to 5/)).toHaveCount(0);

    // outside the range: saved but flagged
    await fillNumber(temp, "9");
    await temp.getByRole("button", { name: "Save reading" }).click();
    await expectSoon(
      page.getByText("Outside 0 to 5, tell your manager"),
    ).toBeVisible();
    await expectSoon(page.getByText("Your reading is saved.")).toBeVisible();
    await expectSoon(page.getByText(/1 reading outside range/)).toBeVisible();
    // back inside: the flag goes
    await fillNumber(temp, "4");
    await temp.getByRole("button", { name: "Save reading" }).click();
    await expectSoon(
      page.getByText("Outside 0 to 5, tell your manager"),
    ).toHaveCount(0);

    // a note
    const text = unique("All locked up");
    const note = card(page, NOTE);
    await note.getByRole("textbox").fill(text);
    await note.getByRole("button", { name: "Save note" }).click();
    await expectSoon(note.getByText(/^Saved \d/)).toBeVisible();

    // not applicable, then undo
    const till = card(page, TICK_2);
    await till.getByRole("button", { name: "Not applicable" }).click();
    await till
      .getByRole("textbox", { name: /Why does this not apply/ })
      .fill("No till tonight");
    await till.getByRole("button", { name: "Mark not applicable" }).click();
    await expectSoon(
      page.getByText("Not applicable: No till tonight"),
    ).toBeVisible();
    await expectSoon(page.getByText(/1 not applicable/)).toBeVisible();
    await page.getByRole("button", { name: "Undo, this applies" }).click();
    await expectSoon(
      page.getByText("Not applicable: No till tonight"),
    ).toHaveCount(0);

    // my own item
    const mine = unique("Wipe the bar");
    await page.getByRole("textbox", { name: "What needs doing?" }).fill(mine);
    await page.getByRole("button", { name: "Add item" }).click();
    await expectSoon(page.getByText(mine, { exact: true })).toBeVisible();
    await expectSoon(page.getByText(/of 7 done/)).toBeVisible();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a photo is uploaded from a generated JPEG", async ({ page }) => {
  const { shift, listId } = await freshList();
  try {
    await openList(page, listId);
    const file = await jpeg(page);
    await card(page, PHOTO).locator('input[type="file"]').setInputFiles({
      name: "kitchen.jpg",
      mimeType: "image/jpeg",
      buffer: file,
    });
    await expectSoon(
      page.getByRole("group", { name: `Photo for ${PHOTO}` }),
    ).toBeVisible();
    await expectSoon(page.getByText(/1 of 6 done/)).toBeVisible();
    await expectSoon(
      card(page, PHOTO).getByText("Take or choose a new photo"),
    ).toBeVisible();
  } finally {
    await cancelShift(shift.id);
  }
});

test("finishing is refused while required items are missing, works when complete, then the list is read-only", async ({
  page,
}) => {
  const { shift, listId } = await freshList();
  const v = await venuePath();
  try {
    await openList(page, listId);
    await page.getByRole("button", { name: "Finish list" }).click();
    await expectSoon(page.getByText("Not finished yet")).toBeVisible();
    await expectSoon(page.getByText(/Still to do/)).toBeVisible();
    await expect(page.getByText(/Finished, /)).toHaveCount(0);

    // complete every required item
    for (const label of [TICK_1, TICK_2, TICK_3]) {
      await card(page, label).getByRole("switch").click();
      await expectSoon(
        card(page, label).getByText("Done", { exact: true }),
      ).toBeVisible();
    }
    const temp = card(page, TEMP);
    await fillNumber(temp, "2");
    await temp.getByRole("button", { name: "Save reading" }).click();
    await expectSoon(page.getByText(/4 of 6 done/)).toBeVisible();
    const file = await jpeg(page);
    await card(page, PHOTO).locator('input[type="file"]').setInputFiles({
      name: "kitchen.jpg",
      mimeType: "image/jpeg",
      buffer: file,
    });
    await expectSoon(
      page.getByText(/5 of 6 done, 5 of 5 required/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Finish list" }).click();
    await expectSoon(
      page.getByText(
        "This list is finished. Ask a manager if something needs to change.",
      ),
    ).toBeVisible();
    await expectSoon(page.getByText(/^Finished /).first()).toBeVisible();
    await expect(page.getByText("Done", { exact: true }).first()).toBeVisible();

    // read only: nothing to press or type
    await expect(page.getByRole("button", { name: "Finish list" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Add item" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save reading" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save note" }),
    ).toBeDisabled();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    for (const sw of await page.getByRole("switch").all())
      await expect(sw).toBeDisabled();

    // the backend agrees it is done (the index shows the soonest 200 lists, and this one is weeks away)
    const detail = await must(
      api("staff", "GET", `${v}/workflows/me/lists/${listId}`),
      "list",
    );
    expect(detail.status).toBe("done");
  } finally {
    await cancelShift(shift.id);
  }
});

test("the checklists page groups lists and a link opens one", async ({
  page,
}) => {
  const { shift, listId } = await freshList();
  try {
    const id = await signIn(page, "staff");
    await openVenuePage(page, id, "lists");
    await expectSoon(
      page.getByRole("heading", { name: "My checklists", level: 1 }),
    ).toBeVisible();
    await expectSoon(
      page.getByRole("heading", { name: "To do", level: 2, exact: true }),
    ).toBeVisible();
    // The index shows the soonest 200 lists and this one is weeks away, so follow a link the index does show when this
    // one is not on the page, and open this one by its address.
    const link = page.locator(`a[href$="/lists/${listId}"]`);
    if ((await link.count()) > 0) await link.click();
    else {
      await expect(page.locator('a[href*="/lists/"]').first()).toBeVisible();
      await page.goto(`/venues/${id}/lists/${listId}`);
    }
    await page.waitForURL(new RegExp(`/lists/${listId}$`));
    await expectSoon(
      page.getByRole("heading", { name: "Closing", level: 1 }),
    ).toBeVisible();
  } finally {
    await cancelShift(shift.id);
  }
});

test("a person with no checklists sees the empty sentence", async ({
  page,
}) => {
  const v = await venuePath();
  const mine = await must(
    api("manager", "GET", `${v}/workflows/me/lists`),
    "lists",
  );
  test.skip(
    mine.items.length > 0,
    "the manager login has checklists right now",
  );
  const id = await signIn(page, "manager");
  await openVenuePage(page, id, "lists");
  await expectSoon(
    page.getByText("You have no checklists right now."),
  ).toBeVisible();
});

test("an unknown checklist or venue is not found", async ({ page }) => {
  const id = await signIn(page, "staff");
  const none = "00000000-0000-4000-8000-000000000000";
  // the page streams, so the status can already be 200: the not-found page itself is what must show
  for (const path of [
    `/venues/${id}/lists/${none}`,
    `/venues/${id}/lists/not-an-id`,
    `/venues/${none}/lists`,
  ]) {
    await page.goto(path);
    await expectSoon(
      page
        .getByText(/not found|could not be found|does not exist|404/i)
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish list" })).toHaveCount(
      0,
    );
  }
});

test("phone width has no sideways scroll on the list and the index", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { shift, listId } = await freshList();
  try {
    const id = await openList(page, listId);
    const over = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
    expect(await over()).toBeLessThanOrEqual(0);
    await openVenuePage(page, id, "lists");
    await expectSoon(
      page.getByRole("heading", { name: "My checklists", level: 1 }),
    ).toBeVisible();
    expect(await over()).toBeLessThanOrEqual(0);
  } finally {
    await cancelShift(shift.id);
  }
});
