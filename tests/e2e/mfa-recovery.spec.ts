/**
 * Second-factor flows with recovery codes (ASVS 6.4.4) against a live backend whose login service requires a second
 * factor of every role. Needs the stack, its mail catcher and a production build of the UI; see ui/UI_PROGRESS.md.
 * Skipped unless E2E_MFA=1. Env: E2E_AUTH_URL, E2E_SERVICE_KEY (as in auth-flows.spec.ts).
 */
import { createHmac } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const AUTH = process.env.E2E_AUTH_URL ?? "http://localhost:54421/auth/v1";
const SERVICE =
  process.env.E2E_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "Tr1cky-Spike-Horse-91x";

test.skip(process.env.E2E_MFA !== "1", "needs the MFA stack (E2E_MFA=1)");

const octet = () => Math.floor(Math.random() * 250) + 1;
const fakeIp = () => `10.${octet()}.${octet()}.${octet()}`;

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-real-ip": fakeIp() });
});

const unique = () =>
  `mfa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;

function base32(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/[=\s]+/g, "").toUpperCase())
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238: HMAC-SHA1, 30 second step, 6 digits. */
function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const mac = createHmac("sha1", base32(secret)).update(counter).digest();
  const offset = (mac[mac.length - 1] as number) & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, "0");
}

async function createUser(): Promise<string> {
  const email = unique();
  const r = await fetch(`${AUTH}/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  expect(r.status).toBeLessThan(300);
  return email;
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** On /mfa/enroll: start the authenticator app set-up, read the shared secret and confirm with a code. */
async function enrol(page: Page): Promise<string> {
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: "Set up an authenticator app" })
    .click();
  await expect(
    page.getByAltText("QR code for your authenticator app"),
  ).toBeVisible();
  const key = (await page.getByText(/Cannot scan it\?/).innerText())
    .split(":")
    .pop()
    ?.trim() as string;
  await page.getByLabel("6-digit code").fill(totp(key));
  await page.getByRole("button", { name: "Turn on" }).click();
  return key;
}

/** On /mfa/recovery-codes: make the codes, check they are shown, and carry on. Returns the ten codes as typed-clean. */
async function takeCodes(page: Page): Promise<string[]> {
  await expect(page).toHaveURL(/\/mfa\/recovery-codes/);
  await page.getByRole("button", { name: "Make my recovery codes" }).click();
  await expect(
    page.getByText("This is the only time they are shown"),
  ).toBeVisible({ timeout: 20_000 });
  const shown = await page.locator("ul li").allInnerTexts();
  expect(shown).toHaveLength(10);
  const codes = shown.map((c) => c.replace(/-/g, ""));
  expect(new Set(codes).size).toBe(10);
  for (const code of codes) expect(code).toMatch(/^[a-z2-7]{13,32}$/);
  await page.getByLabel("I have saved these codes").check();
  await page.getByRole("link", { name: "Continue" }).click();
  return codes;
}

/** A confirmed person with a venue, an authenticator app and ten saved codes, ending signed in on the home page. */
async function enrolledOwner(page: Page) {
  const email = await createUser();
  await signIn(page, email);
  await page.getByRole("link", { name: "Set up a venue" }).click();
  await page.getByLabel("Venue name").fill("The MFA Kitchen");
  await page.getByRole("button", { name: "Set up venue" }).click();
  await expect(page).toHaveURL(/\/mfa\/enroll/);
  const key = await enrol(page);
  const codes = await takeCodes(page);
  await expect(
    page.getByRole("link", { name: "The MFA Kitchen" }),
  ).toBeVisible();
  return { email, key, codes };
}

async function signOut(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

/** Sign in with the password and stop at the recovery-code form. */
async function toRecoveryForm(page: Page, email: string) {
  await signIn(page, email);
  await expect(page).toHaveURL(/\/mfa\/challenge/);
  await page
    .getByRole("link", { name: "Lost your phone? Use a recovery code" })
    .click();
  await expect(page).toHaveURL(/\/mfa\/recovery/);
  await page.waitForLoadState("networkidle");
}

async function tryCode(page: Page, code: string) {
  await page.getByLabel("Recovery code").fill(code);
  await page.getByRole("button", { name: "Sign in with this code" }).click();
}

const showing = (code: string) => (code.match(/.{1,4}/g) ?? []).join("-");

test("the recovery codes are shown once, ten of them, and the page does not show them again", async ({
  page,
}) => {
  const { codes } = await enrolledOwner(page);
  expect(codes).toHaveLength(10);
  // asking again offers new ones, never the old ones
  await page.goto("/mfa/recovery-codes");
  await expect(page.getByText("You have 10 recovery codes left")).toBeVisible();
  for (const code of codes)
    await expect(page.getByText(showing(code))).toHaveCount(0);
});

test("a person who lost their app signs in with a recovery code; the same code a second time is refused", async ({
  page,
}) => {
  const { email, codes } = await enrolledOwner(page);
  await signOut(page);
  await toRecoveryForm(page, email);
  await tryCode(page, showing(codes[0] as string)); // typed with dashes, as shown
  await expect(
    page.getByRole("heading", { name: "Your venues" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "The MFA Kitchen" }),
  ).toBeVisible();

  await signOut(page);
  await toRecoveryForm(page, email);
  await tryCode(page, codes[0] as string);
  await expect(
    page.getByText("That recovery code is not right, or it was already used."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/mfa\/recovery/);
  // a different code still works
  await tryCode(page, (codes[1] as string).toUpperCase());
  await expect(
    page.getByRole("heading", { name: "Your venues" }),
  ).toBeVisible();
});

test("a wrongly typed code is refused in plain words", async ({ page }) => {
  const { email, codes } = await enrolledOwner(page);
  await signOut(page);
  await toRecoveryForm(page, email);
  await tryCode(page, "abc");
  await expect(
    page.getByText("That does not look like a recovery code."),
  ).toBeVisible();
  // right shape, wrong code: one character changed
  const first = codes[0] as string;
  const wrong = `${first.slice(0, -1)}${first.endsWith("a") ? "b" : "a"}`;
  await tryCode(page, wrong);
  await expect(
    page.getByText("That recovery code is not right, or it was already used."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/mfa\/recovery/);
});

test("five wrong codes lock recovery for that person with a plain message, and another person is unaffected", async ({
  page,
  browser,
}) => {
  const a = await enrolledOwner(page);
  // a second, unrelated person in their own browser context
  const other = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    extraHTTPHeaders: { "x-real-ip": fakeIp() },
  });
  try {
    const otherPage = await other.newPage();
    const b = await enrolledOwner(otherPage);

    await signOut(page);
    await toRecoveryForm(page, a.email);
    const wrong = "abcdefghijklmnop".replace(
      /./g,
      (c, i) => "abcdefghijklmnop"[(i + 1) % 16] ?? c,
    );
    for (let i = 0; i < 5; i++) {
      await tryCode(page, wrong);
      await expect(
        page.getByText(/That recovery code is not right|Too many wrong codes/),
      ).toBeVisible();
    }
    // the lock is on now: even a real code is refused, with the plain lock message
    await tryCode(page, a.codes[2] as string);
    await expect(
      page.getByText(
        "Too many wrong codes. Wait 15 minutes, or ask the venue owner to reset your second factor.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/mfa\/recovery/);

    // the other person can still sign in with a recovery code
    await signOut(otherPage);
    await toRecoveryForm(otherPage, b.email);
    await tryCode(otherPage, b.codes[0] as string);
    await expect(
      otherPage.getByRole("heading", { name: "Your venues" }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

test("the owner resets a person's second factor and the person, who lost their app and codes, enrols again", async ({
  page,
  browser,
}) => {
  const owner = await enrolledOwner(page);
  const memberEmail = await createUser();

  // the owner adds the person with their email, which sends an invitation
  await page.getByRole("link", { name: "The MFA Kitchen" }).click();
  await page
    .getByRole("link", { name: /Team|People/ })
    .first()
    .click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").first().fill("Mia Member");
  await page.getByLabel("Email").first().fill(memberEmail);
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.getByText(memberEmail).first()).toBeVisible();
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(
    page.getByText(`We emailed an invite to ${memberEmail}.`),
  ).toBeVisible();
  const teamUrl = page.url();

  // the person signs in, adds a second factor, accepts the invitation
  const ctx = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    extraHTTPHeaders: { "x-real-ip": fakeIp() },
  });
  try {
    const mp = await ctx.newPage();
    await signIn(mp, memberEmail);
    await mp.waitForURL((u) => !/sign-in/.test(u.pathname));
    await mp.goto("/mfa/enroll");
    const oldKey = await enrol(mp);
    await takeCodes(mp);
    await mp.getByRole("button", { name: "Accept" }).click();
    await expect(mp.getByText(/Mia|The MFA Kitchen/).first()).toBeVisible();
    await signOut(mp);

    // the owner resets it from the Team screen
    await page.goto(teamUrl);
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("button", { name: "Reset their second factor" })
      .click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(
      page.getByText("Their second factor was removed."),
    ).toBeVisible();

    // the person signs in with the password only and is asked to enrol again
    await signIn(mp, memberEmail);
    await expect(mp).toHaveURL(/\/mfa\/enroll/);
    const newKey = await enrol(mp);
    expect(newKey).not.toBe(oldKey);
    const fresh = await takeCodes(mp);
    expect(fresh).toHaveLength(10);
    await expect(
      mp.getByRole("link", { name: "The MFA Kitchen" }),
    ).toBeVisible();
  } finally {
    await ctx.close();
  }
  expect(owner.email).toBeTruthy();
});
