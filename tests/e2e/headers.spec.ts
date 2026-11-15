import { expect, test } from "@playwright/test";

test("every page response carries the security headers and no framework banner", async ({
  request,
}) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(response.status()).toBe(200);
  expect(headers["strict-transport-security"]).toBe(
    "max-age=63072000; includeSubDomains",
  );
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cache-control"]).toBe("no-store");
  expect(headers["x-powered-by"]).toBeUndefined();
  const csp = headers["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toMatch(
    /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/,
  );
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
});

test("the nonce changes on every request and every script carries it", async ({
  request,
}) => {
  const nonceOf = (csp: string) => csp.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
  const first = await request.get("/");
  const second = await request.get("/");
  const a = nonceOf(first.headers()["content-security-policy"]);
  const b = nonceOf(second.headers()["content-security-policy"]);
  expect(a).toBeTruthy();
  expect(a).not.toBe(b);
  const html = await first.text();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  expect(scripts.length).toBeGreaterThan(0);
  for (const tag of scripts) expect(tag).toContain(`nonce="${a}"`);
  const styleElements = html.match(/<style\b[^>]*>/g) ?? [];
  for (const tag of styleElements) expect(tag).toContain(`nonce="${a}"`);
});

test("the page runs under the policy: no violation, and the Astryx styles apply", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/.test(message.text()))
      violations.push(message.text());
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const button = await page
    .getByRole("button", { name: "Sign in" })
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return { background: style.backgroundColor, font: style.fontFamily };
    });
  expect(button.background).not.toBe("rgba(0, 0, 0, 0)"); // the theme reached the button
  expect(button.font).toContain("Figtree");
  expect(violations).toEqual([]);
});

test("the page cannot be framed by another site", async ({ page, baseURL }) => {
  // A page that frame-ancestors refuses is replaced in its frame by the browser's own error page.
  await page.goto("about:blank");
  await page.evaluate(
    (url) =>
      new Promise<void>((resolve) => {
        const frame = document.createElement("iframe");
        frame.onload = () => resolve();
        frame.src = url;
        document.body.appendChild(frame);
        setTimeout(resolve, 3000);
      }),
    `${baseURL}/`,
  );
  await page.waitForTimeout(300);
  const urls = page.frames().map((frame) => frame.url());
  expect(urls.some((url) => url.startsWith("chrome-error://"))).toBe(true);
  expect(urls.some((url) => url === `${baseURL}/`)).toBe(false);
});
