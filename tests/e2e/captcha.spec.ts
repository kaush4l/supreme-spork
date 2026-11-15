/**
 * The CAPTCHA widget (Cloudflare Turnstile) with Cloudflare's always-pass test keys.
 * Needs the live backend with CAPTCHA_ENABLED=true and CAPTCHA_SECRET=1x0000000000000000000000000000000AA, the UI with
 * TURNSTILE_SITE_KEY=1x00000000000000000000AA, and the internet (the widget loads from Cloudflare).
 * Skipped unless E2E_CAPTCHA=1.
 */
import { expect, test } from "@playwright/test";

test.skip(
  process.env.E2E_CAPTCHA !== "1",
  "needs the CAPTCHA-enabled stack (E2E_CAPTCHA=1)",
);

const AUTH = process.env.E2E_AUTH_URL ?? "http://localhost:54421/auth/v1";
const SERVICE =
  process.env.E2E_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
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
