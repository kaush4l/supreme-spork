/**
 * The sign-in screens against a live backend and login service (security plan U2).
 * Needs the backend stack up with its mail catcher and a second factor required of every role; see ui/UI_PROGRESS.md in
 * the documents folder for how. Skipped unless E2E_LIVE=1, so the CI job without a backend still passes.
 */
import { createHmac } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const LIVE = process.env.E2E_LIVE === "1";
const MAIL = process.env.E2E_MAIL_URL ?? "http://localhost:8625";
const AUTH = process.env.E2E_AUTH_URL ?? "http://localhost:54421/auth/v1";
const ANON =
  process.env.E2E_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.E2E_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PASSWORD = "Tr1cky-Spike-Horse-91x";

test.skip(!LIVE, "needs the live backend stack (E2E_LIVE=1)");

// A real deployment has a proxy that puts the visitor's address in `x-real-ip`; the UI passes it on so the login service
// limits sign-in attempts per visitor. Without it every test would share one address and one limit, so each test plays
// the proxy with an address of its own.
test.beforeEach(async ({ context }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await context.setExtraHTTPHeaders({
    "x-real-ip": `10.${octet()}.${octet()}.${octet()}`,
  });
});

const unique = () =>
  `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`;

function base32(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/=+$/, "").toUpperCase())
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret: string): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac("sha1", base32(secret)).update(counter).digest();
  const offset = (mac[mac.length - 1] as number) & 15;
  const value = ((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, "0");
  return value;
}

async function mailFor(address: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = (await (await fetch(`${MAIL}/api/v1/messages`)).json()) as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    const mine = list.messages.find((m) =>
      m.To.some((t) => t.Address === address),
    );
    if (mine)
      return (
        (await (await fetch(`${MAIL}/api/v1/message/${mine.ID}`)).json()) as {
          Text: string;
        }
      ).Text;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no mail for ${address}`);
}

const linkIn = (text: string) =>
  (
    text.match(/https?:\/\/[^\s"<>)]+\/verify[^\s"<>)]+/) as RegExpMatchArray
  )[0].replace(/&amp;/g, "&");

async function confirmedUser(): Promise<string> {
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

function watchPolicy(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text()))
      violations.push(message.text());
  });
  return violations;
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle"); // typing before the page is hydrated would be lost
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a new person signs up, confirms by email, sets up a venue, is made to add a second step, and signs back in with a code", async ({
  page,
}) => {
  const violations = watchPolicy(page);
  const email = unique();

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page
    .getByRole("textbox", { name: "Password Required", exact: true })
    .fill(PASSWORD);
  await page.getByLabel("Type the password again").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/sign-up\/check-email/);

  // not confirmed yet: signing in is refused with a plain sentence
  await signIn(page, email);
  await expect(
    page.getByText("Confirm your email address first"),
  ).toBeVisible();

  await page.goto(linkIn(await mailFor(email)));
  await expect(page).toHaveURL(/\/sign-in\?confirmed=1/);
  await expect(page.getByText("Your email address is confirmed")).toBeVisible();

  await signIn(page, email);
  await expect(
    page.getByRole("heading", { name: "Your venues" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Set up a venue" }).click();
  await page.getByLabel("Venue name").fill("The E2E Kitchen");
  await page.getByRole("button", { name: "Set up venue" }).click();

  // the new owner needs a second factor before the venue opens
  await expect(page).toHaveURL(/\/mfa\/enroll/);
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
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("not right, or it has expired")).toBeVisible();
  await page.getByLabel("6-digit code").fill(totp(key));
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(
    page.getByRole("heading", { name: "Your venues" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "The E2E Kitchen" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "The E2E Kitchen" }).click();
  await expect(page.getByText("Your role here: owner")).toBeVisible();

  // the owner changes who may do what, and it survives a reload
  await page.getByRole("link", { name: "Who can do what" }).click();
  await expect(
    page.getByRole("heading", { name: "Who can do what" }),
  ).toBeVisible();
  const pay = () =>
    page.getByRole("switch", { name: /Manager: Change someone's pay/ });
  await expect(pay()).toBeChecked();
  await pay().click();
  await expect(pay()).not.toBeChecked();
  await page.reload();
  await expect(pay()).not.toBeChecked();
  await pay().click();
  await expect(pay()).toBeChecked();

  await page.goto("/");
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/mfa\/challenge/);
  await page.getByLabel("6-digit code").fill(totp(key));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(
    page.getByRole("link", { name: "The E2E Kitchen" }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});

test("a wrong password and an address with no account get the same answer", async ({
  page,
}) => {
  const email = await confirmedUser();
  await signIn(page, email, "not-the-password-at-all-1");
  const wrong = await page
    .getByText(/do not match|Too many attempts/)
    .first()
    .innerText();
  await signIn(
    page,
    `nobody-${unique()}`.replace(/^nobody-/, "nobody-"),
    "not-the-password-at-all-1",
  );
  // the second field is not even an address, so use a well-formed unknown one
  await signIn(page, `nobody-${unique()}`, "not-the-password-at-all-1");
  const unknown = await page
    .getByText(/do not match|Too many attempts|Check the details/)
    .first()
    .innerText();
  expect(wrong).toBe("That email and password do not match.");
  expect(unknown).toMatch(/do not match|Check the details/);
});

test("asking for a reset says the same thing for any address, and the link lets the person choose a new password", async ({
  page,
}) => {
  const email = await confirmedUser();
  await page.goto("/forgot-password");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send the link" }).click();
  const unknown = await page.getByText(/we have sent/i).innerText();

  await page.goto("/forgot-password");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send the link" }).click();
  expect(await page.getByText(/we have sent/i).innerText()).toBe(unknown);

  await page.goto(linkIn(await mailFor(email)));
  await expect(page).toHaveURL(/\/reset-password/);
  const next = "Brand-new-passphrase-77";
  await page.getByLabel("New password").fill(next);
  await page.getByLabel("Type it again").fill(next);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(
    page.getByRole("heading", { name: "Your venues" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sign out of this device" }).click();
  await signIn(page, email, PASSWORD);
  await expect(
    page.getByText("That email and password do not match"),
  ).toBeVisible();
  await signIn(page, email, next);
  await expect(
    page.getByRole("heading", { name: "Your venues" }),
  ).toBeVisible();
});

test("a sign-in link cannot send a person to another site", async ({
  page,
}) => {
  const email = await confirmedUser();
  for (const hostile of [
    "https://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
  ]) {
    await page.goto(`/sign-in?next=${encodeURIComponent(hostile)}`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Your venues" }),
    ).toBeVisible();
    expect(new URL(page.url()).host).toBe("localhost:3111");
    await page.getByRole("button", { name: "Sign out of this device" }).click();
  }
});

test("a signed-out visitor cannot open any signed-in page", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/venues/new",
    "/account/password",
    "/mfa/enroll",
    "/mfa/challenge",
    "/reset-password",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in/);
  }
  const unknownVenue = await page.goto(
    "/venues/00000000-0000-0000-0000-000000000000",
  );
  expect(new URL(page.url()).pathname).toBe("/sign-in");
  expect(unknownVenue?.status()).toBeLessThan(500);
});
