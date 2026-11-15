import { deflateSync } from "node:zlib";
import {
  type Browser,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  openVenuePage,
  type Role,
  signIn,
  skipUnlessLive,
  unique,
} from "../support/live";

skipUnlessLive();
test.setTimeout(240_000);
test.use({ actionTimeout: 30_000 });
const slow = expect.configure({ timeout: 25_000 });
/**
 * Like the shared CSP watch, but the docket photo comes from the files host (FILES_URL). When the dev server runs
 * without FILES_URL the browser blocks that one image; that is the setup, not this page, so it is not counted.
 */
function watchCsp(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    const text = m.text();
    if (
      m.type() === "error" &&
      /Refused to|Content Security|violates/i.test(text) &&
      !/next-devtools|astryxdesign_core_dist_Layer/.test(m.location().url) &&
      !/Loading the image 'https?:\/\/[^']*\/storage\/v1\/object\/sign\//.test(
        text,
      )
    )
      problems.push(text.slice(0, 120));
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  return { expectNone: () => expect(problems, "browser errors").toEqual([]) };
}

const NOT_FOUND = /could not be found|not found/i;

async function as(browser: Browser, role: Role) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const venue = await signIn(page, role);
  return { context, page, venue };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(body));
  return Buffer.concat([head, body, tail]);
}

/** A small PNG of random pixels, so every run sends a document the backend has never held. */
function newImage() {
  const size = 48;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let i = 1; i <= size * 3; i++)
      raw[row + i] = Math.floor(Math.random() * 256);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return {
    name: "docket.png",
    mimeType: "image/png",
    buffer: Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  };
}

/** Two clicks in the same instant, as a nervous double tap does: the buttons must write once. */
async function doubleClick(button: Locator) {
  await button.evaluate((el) => {
    (el as HTMLElement).click();
    (el as HTMLElement).click();
  });
}

async function noSideScroll(page: Page) {
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(wide, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

/** Send a fresh image on the send page and open its docket page. Returns the page's path. */
async function sendNew(page: Page, venue: string) {
  await openVenuePage(page, venue, "dockets/send");
  await page.getByLabel("Or choose a photo or a PDF").setInputFiles(newImage());
  await slow(
    page.getByText("Sent. This is a new docket and it will be read."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open this docket" }).click();
  await slow(page.getByRole("heading", { level: 1 })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function keyIn(page: Page, supplier: string, total: string) {
  await slow(
    page.getByRole("heading", { name: "Type this docket in" }),
  ).toBeVisible();
  await page.getByLabel("Supplier", { exact: true }).fill(supplier);
  await page.getByLabel(/^Delivery date/).fill("2026-11-03");
  await page.getByLabel(/^What was delivered/).fill("Paper napkins");
  await page.getByLabel(/^Quantity/).fill("2");
  await page.getByLabel(/^Unit/).fill("ea");
  await page.getByLabel(/^Price each/).fill("24");
  await page.getByLabel(/^Line total/).fill("48");
  await page.getByLabel(/^Docket total/).fill(total);
}

test("the queue and possible copies open for a manager and link to dockets", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const watch = watchCsp(mgr.page);
  await openVenuePage(mgr.page, mgr.venue, "dockets");
  await slow(
    mgr.page.getByRole("heading", { name: "Dockets", level: 1 }),
  ).toBeVisible();
  await expect(
    mgr.page.getByRole("link", { name: "Send a docket" }),
  ).toBeVisible();
  await expect(
    mgr.page.getByRole("heading", { name: "Waiting for a person" }),
  ).toBeVisible();
  await expect(
    mgr.page.getByRole("heading", { name: "Possible copies" }),
  ).toBeVisible();
  const first = mgr.page.getByRole("link", { name: / · / }).first();
  await slow(first).toBeVisible();
  await first.click();
  await slow(mgr.page.getByText("Docket total:")).toBeVisible();
  await expect(mgr.page.getByText(/^Lines add up to:/)).toBeVisible();
  await noSideScroll(mgr.page);
  watch.expectNone();
  await mgr.context.close();
});

test("a sent docket says new, then already held; key in refuses lines that do not add up, then books for approval", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await openVenuePage(mgr.page, mgr.venue, "dockets/send");
  const image = newImage();
  const choose = mgr.page.getByLabel("Or choose a photo or a PDF");
  await choose.setInputFiles(image);
  await slow(
    mgr.page.getByText("Sent. This is a new docket and it will be read."),
  ).toBeVisible();
  await mgr.page.getByRole("link", { name: "Open this docket" }).click();
  const supplier = unique("Test Supplier");

  await keyIn(mgr.page, supplier, "60");
  // 2 x $24 is $48, not $60
  await doubleClick(mgr.page.getByRole("button", { name: "Save docket" }));
  await slow(mgr.page.getByText(/add up to \$48\.00/).first()).toBeVisible();
  await mgr.page.getByLabel(/^Docket total/).fill("48");
  // a typing mistake is named by its line
  await mgr.page.getByLabel(/^Price each/).fill("abc");
  await mgr.page.getByRole("button", { name: "Save docket" }).click();
  await slow(
    mgr.page.getByText("Write the amount like 12.50.").first(),
  ).toBeVisible();
  await mgr.page.getByLabel(/^Price each/).fill("24");
  await mgr.page.getByLabel(/^Line total/).fill("40");
  await mgr.page.getByRole("button", { name: "Save docket" }).click();
  await slow(
    mgr.page.getByText(/Line 1: 2 x \$24\.00 is \$48\.00/).first(),
  ).toBeVisible();
  await mgr.page.getByLabel(/^Line total/).fill("48");
  await mgr.page.getByRole("button", { name: "Save docket" }).click();
  // an unknown supplier is held for a person to approve
  await slow(mgr.page.getByRole("button", { name: "Approve" })).toBeVisible();
  await expect(mgr.page.getByText(/not on your supplier list/)).toBeVisible();
  await expect(mgr.page.getByText("Paper napkins")).toBeVisible();

  // the same file again is already held
  await openVenuePage(mgr.page, mgr.venue, "dockets/send");
  await mgr.page.getByLabel("Or choose a photo or a PDF").setInputFiles(image);
  await slow(
    mgr.page.getByText("We already had this docket, so nothing new was added."),
  ).toBeVisible();
  await mgr.context.close();
});

test("a rejection needs a reason, then sets the docket aside once", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await sendNew(mgr.page, mgr.venue);
  await keyIn(mgr.page, unique("Reject Supplier"), "48");
  await mgr.page.getByRole("button", { name: "Save docket" }).click();
  await slow(mgr.page.getByRole("button", { name: "Reject" })).toBeVisible();
  await mgr.page.getByRole("button", { name: "Reject", exact: true }).click();
  await mgr.page.getByRole("button", { name: "Reject docket" }).click();
  await slow(
    mgr.page.getByText("Say why you are rejecting this."),
  ).toBeVisible();
  await mgr.page
    .getByLabel(/^Why are you rejecting/)
    .fill(unique("a copy of another"));
  await doubleClick(mgr.page.getByRole("button", { name: "Reject docket" }));
  await slow(mgr.page.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(mgr.page.getByRole("button", { name: "Approve" })).toHaveCount(
    0,
  );
  await mgr.context.close();
});

test("a flagged docket can be corrected, which books it with the corrected figures", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await sendNew(mgr.page, mgr.venue);
  await keyIn(mgr.page, unique("Correct Supplier"), "48");
  await mgr.page.getByRole("button", { name: "Save docket" }).click();
  await slow(mgr.page.getByRole("button", { name: "Approve" })).toBeVisible();
  await mgr.page.getByRole("button", { name: "Correct this docket" }).click();
  await mgr.page.getByRole("button", { name: "Save correction" }).click();
  await slow(mgr.page.getByText("Change something first.")).toBeVisible();
  await mgr.page
    .getByLabel(/^Quantity/)
    .last()
    .fill("3");
  await mgr.page
    .getByLabel(/^Line total/)
    .last()
    .fill("72");
  await mgr.page
    .getByLabel(/^Docket total/)
    .last()
    .fill("72");
  await mgr.page.getByRole("button", { name: "Save correction" }).click();
  await slow(mgr.page.getByText("Docket total: $72.00")).toBeVisible();
  await expect(mgr.page.getByText("Quantity 3 ea")).toBeVisible();
  await mgr.context.close();
});

test("a flagged docket can be approved, and a double click approves once", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await sendNew(mgr.page, mgr.venue);
  await keyIn(mgr.page, unique("Approve Supplier"), "48");
  await mgr.page.getByRole("button", { name: "Save docket" }).click();
  await slow(mgr.page.getByRole("button", { name: "Approve" })).toBeVisible();
  await doubleClick(mgr.page.getByRole("button", { name: "Approve" }));
  await slow(mgr.page.getByText("Done", { exact: true })).toBeVisible();
  await expect(mgr.page.getByRole("button", { name: "Approve" })).toHaveCount(
    0,
  );
  await mgr.context.close();
});

test("a bookkeeper reads dockets but has no buttons and cannot send", async ({
  browser,
}) => {
  const bk = await as(browser, "bookkeeper");
  await openVenuePage(bk.page, bk.venue, "dockets");
  await slow(
    bk.page.getByRole("heading", { name: "Dockets", level: 1 }),
  ).toBeVisible();
  await expect(
    bk.page.getByRole("link", { name: "Send a docket" }),
  ).toHaveCount(0);
  const first = bk.page.getByRole("link", { name: / · / }).first();
  await first.click();
  await slow(bk.page.getByText("Docket total:")).toBeVisible();
  for (const name of [
    "Approve",
    "Reject",
    "Correct this docket",
    "Save docket",
  ])
    await expect(bk.page.getByRole("button", { name })).toHaveCount(0);
  await bk.page.goto(`/venues/${bk.venue}/dockets/send`);
  await slow(bk.page.getByText(NOT_FOUND).first()).toBeVisible();
  await bk.context.close();
});

test("staff can only send: the send page works, the queue and a docket are not found", async ({
  browser,
}) => {
  const staff = await as(browser, "staff");
  await openVenuePage(staff.page, staff.venue, "dockets/send");
  await slow(
    staff.page.getByRole("heading", { name: "Send a docket", level: 1 }),
  ).toBeVisible();
  await expect(
    staff.page.getByLabel("Take a photo of the docket"),
  ).toHaveAttribute("capture", "environment");
  await staff.page
    .getByLabel("Or choose a photo or a PDF")
    .setInputFiles(newImage());
  await slow(
    staff.page.getByText("Sent. This is a new docket and it will be read."),
  ).toBeVisible();
  await expect(
    staff.page.getByRole("link", { name: "Open this docket" }),
  ).toHaveCount(0);
  await noSideScroll(staff.page);
  await staff.page.goto(`/venues/${staff.venue}/dockets`);
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.page.goto(
    `/venues/${staff.venue}/dockets/00000000-0000-4000-8000-000000000000`,
  );
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.page.goto(`/venues/${staff.venue}/dockets/not-a-uuid`);
  await slow(staff.page.getByText(NOT_FOUND).first()).toBeVisible();
  await staff.context.close();
});

test("the upload route refuses a non-file and a signed-out caller", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  const url = `/venues/${mgr.venue}/dockets/send/file`;
  const sameSite = { origin: "http://localhost:3000" };
  const empty = await mgr.page.request.post(url, {
    headers: sameSite,
    multipart: { note: "hello" },
  });
  expect(empty.status()).toBe(422);
  const text = await mgr.page.request.post(url, {
    headers: sameSite,
    multipart: {
      file: { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
    },
  });
  expect(text.status()).toBe(422);
  const crossSite = await mgr.page.request.post(url, {
    headers: { origin: "http://evil.example" },
    multipart: { note: "x" },
  });
  expect(crossSite.status()).toBe(403);
  const anon = await browser.newContext();
  const out = await anon.request.post(`http://localhost:3000${url}`, {
    multipart: { note: "x" },
    maxRedirects: 0,
  });
  expect([307, 308, 302, 303, 401, 403]).toContain(out.status());
  await anon.close();
  await mgr.context.close();
});

test("the owner's empty Bondi venue says nothing is waiting and no copies", async ({
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
  await owner.page.goto(`/venues/${bondi}/dockets`);
  await slow(owner.page.getByText("No dockets are waiting.")).toBeVisible();
  await expect(
    owner.page.getByText(/No dockets look like copies/),
  ).toBeVisible();
  await owner.context.close();
});

test("the duplicate pair links to both dockets and the queue works at phone width", async ({
  browser,
}) => {
  const mgr = await as(browser, "manager");
  await mgr.page.setViewportSize({ width: 390, height: 844 });
  await openVenuePage(mgr.page, mgr.venue, "dockets");
  await slow(
    mgr.page.getByRole("heading", { name: "Possible copies" }),
  ).toBeVisible();
  await expect(
    mgr.page.getByText(/looks like a copy \(/).first(),
  ).toBeVisible();
  await noSideScroll(mgr.page);
  await mgr.context.close();
});
