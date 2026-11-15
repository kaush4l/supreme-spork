/**
 * The CAPTCHA widget (Cloudflare Turnstile) with Cloudflare's always-pass test keys.
 * Needs the live backend with CAPTCHA_ENABLED=true and CAPTCHA_SECRET=1x0000000000000000000000000000000AA, the UI with
 * TURNSTILE_SITE_KEY=1x00000000000000000000AA, and the internet (the widget loads from Cloudflare).
 * Skipped unless E2E_CAPTCHA=1.
 */
import { expect, type Page, test } from "@playwright/test";

test.skip(
  process.env.E2E_CAPTCHA !== "1",
  "needs the CAPTCHA-enabled stack (E2E_CAPTCHA=1)",
);

const AUTH = process.env.E2E_AUTH_URL ?? "http://localhost:54421/auth/v1";
const SERVICE =
  process.env.E2E_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON =
  process.env.E2E_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const PASSWORD = "Tr1cky-Spike-Horse-91x";

test.beforeEach(async ({ context }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await context.setExtraHTTPHeaders({
    "x-real-ip": `10.${octet()}.${octet()}.${octet()}`,
  });
});

test("the widget loads under the page policy, must pass before the button works, and then sign-in succeeds", async ({
  page,
}) => {
  const email = `captcha-${Date.now().toString(36)}@example.com`;
  const created = await fetch(`${AUTH}/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  expect(created.status).toBeLessThan(300);

  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text()))
      violations.push(message.text());
  });

  await page.goto("/sign-in");
  await page.waitForLoadState("domcontentloaded");
  // Cloudflare's script loads under the page policy (allowed by the nonce, its frame by frame-src)
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { turnstile?: unknown }).turnstile ===
      "object",
    undefined,
    { timeout: 30_000 },
  );

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  // the test key passes by itself; until it has, the button stays off and a token is not sent
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(page.locator('input[name="captchaToken"]')).not.toHaveValue("");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Your venues" }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});

/** Watches for policy violations and waits for Cloudflare's script to load under the page policy. */
async function widgetLoads(page: Page, path: string) {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text()))
      violations.push(message.text());
  });
  await page.goto(path);
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { turnstile?: unknown }).turnstile ===
      "object",
    undefined,
    { timeout: 30_000 },
  );
  return violations;
}

test("sign-up: the widget loads, the button waits for it, and the confirmation email is sent", async ({
  page,
}) => {
  const email = `captcha-up-${Date.now().toString(36)}@example.com`;
  const violations = await widgetLoads(page, "/sign-up");
  const button = page.getByRole("button", { name: "Create account" });
  await expect(button).toBeDisabled();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByLabel("Type the password again").fill(PASSWORD);
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('input[name="captchaToken"]')).not.toHaveValue("");
  await button.click();
  await page.waitForURL("**/sign-up/check-email");
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});

test("forgot password: the widget loads, the button waits for it, and the reset request succeeds", async ({
  page,
}) => {
  const email = `captcha-pw-${Date.now().toString(36)}@example.com`;
  const created = await fetch(`${AUTH}/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  expect(created.status).toBeLessThan(300);
  const violations = await widgetLoads(page, "/forgot-password");
  const button = page.getByRole("button", { name: "Send the link" });
  await expect(button).toBeDisabled();
  await page.getByLabel("Email").fill(email);
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('input[name="captchaToken"]')).not.toHaveValue("");
  await button.click();
  await expect(
    page.getByText("Check your email", { exact: true }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});

test("the sign-in service refuses sign-up and password reset requests that carry no CAPTCHA token", async () => {
  const email = `captcha-none-${Date.now().toString(36)}@example.com`;
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    "Content-Type": "application/json",
    "x-real-ip": `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.7`,
  };
  for (const [path, body] of [
    ["signup", { email, password: PASSWORD }],
    ["recover", { email }],
  ] as const) {
    const response = await fetch(`${AUTH}/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    expect([400, 422]).toContain(response.status);
    expect(JSON.stringify(await response.json())).toMatch(/captcha/i);
  }
});

test("the page policy allows a frame from Cloudflare and nothing else", async ({
  request,
}) => {
  const csp = (await request.get("/sign-in")).headers()[
    "content-security-policy"
  ];
  expect(csp).toContain("frame-src https://challenges.cloudflare.com;");
  expect(csp).not.toMatch(/frame-src[^;]*\*/);
  expect(csp).toContain("frame-ancestors 'none'");
});
