import { expect as baseExpect, type Page, test } from "@playwright/test";
import { signIn, skipUnlessLive, watchForBrowserErrors } from "../support/live";

/**
 * "Alerts on this phone" on /account/alerts. No real push service: the browser's service worker registration, the
 * push subscription and the permission prompt are stubbed before the page loads. The stub subscription has a public
 * https endpoint and keys of the real lengths (p256dh 87 characters, auth 22), because the backend checks both.
 * A real push cannot be proven here; the backend's own tests cover sending.
 */
skipUnlessLive();
test.use({ actionTimeout: 15_000 });
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ mode: "serial", timeout: 120_000 });

/** Runs in the page before anything else. The stub's state lives in localStorage so it survives a reload. */
function stubPush() {
  const SUB = "__stubPushSub";
  const PERM = "__stubPushPerm";
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const random = (n: number) => {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(bytes, (b) => alphabet[b % 64]).join("");
  };
  const make = (saved: { endpoint: string; p256dh: string; auth: string }) => ({
    endpoint: saved.endpoint,
    expirationTime: null,
    toJSON: () => ({
      endpoint: saved.endpoint,
      expirationTime: null,
      keys: { p256dh: saved.p256dh, auth: saved.auth },
    }),
    unsubscribe: async () => {
      localStorage.removeItem(SUB);
      return true;
    },
  });
  const load = () => {
    const raw = localStorage.getItem(SUB);
    return raw ? make(JSON.parse(raw)) : null;
  };

  Object.defineProperty(Notification, "permission", {
    configurable: true,
    get: () => localStorage.getItem(PERM) ?? "default",
  });
  Notification.requestPermission = async () => {
    localStorage.setItem(PERM, "granted");
    return "granted";
  };

  PushManager.prototype.subscribe = async (options) => {
    if (!options?.userVisibleOnly) throw new Error("userVisibleOnly missing");
    const key = options.applicationServerKey as ArrayBuffer | Uint8Array;
    if (!key || key.byteLength !== 65)
      throw new Error("applicationServerKey is not a 65 byte key");
    const saved = {
      endpoint: `https://fcm.googleapis.com/fcm/send/${random(140)}`,
      p256dh: random(87),
      auth: random(22),
    };
    localStorage.setItem(SUB, JSON.stringify(saved));
    return make(saved) as unknown as PushSubscription;
  };
  PushManager.prototype.getSubscription = async () =>
    load() as unknown as PushSubscription | null;

  const registration = {
    scope: "/",
    pushManager: Object.create(PushManager.prototype),
  };
  Object.defineProperty(navigator.serviceWorker, "register", {
    configurable: true,
    value: async () => registration,
  });
  Object.defineProperty(navigator.serviceWorker, "getRegistration", {
    configurable: true,
    value: async () => registration,
  });
  Object.defineProperty(navigator.serviceWorker, "ready", {
    configurable: true,
    get: () => Promise.resolve(registration),
  });
}

const alertSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Alerts on this phone" });

test("signed out, the alerts page sends you to sign in", async ({ page }) => {
  await page.goto("/account/alerts");
  await page.waitForURL(/\/sign-in/);
});

test("the manifest and service worker are served without signing in", async ({
  request,
}) => {
  const worker = await request.get("/sw.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-type"]).toMatch(/javascript/);
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const json = await manifest.json();
  expect(json.name).toBe("Minder");
  expect(json.display).toBe("standalone");
  expect(json.start_url).toBe("/");
  const sizes = json.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of json.icons) {
    expect((await request.get(icon.src)).status()).toBe(200);
  }
});

test("alerts go Off, On, reload still On, then Off again", async ({ page }) => {
  const errors = watchForBrowserErrors(page);
  await page.addInitScript(stubPush);
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page, "staff2");
  await page.goto("/account/alerts");
  await expect(
    page.getByRole("heading", { name: "My alerts", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alerts on this phone", level: 2 }),
  ).toBeVisible();

  // A demo stack without push keys says so plainly; there is nothing more to check then.
  const notSetUp = page.getByText("Not set up yet on this server");
  const off = page.getByText("Off", { exact: true });
  await expect(notSetUp.or(off)).toBeVisible();
  test.skip(
    (await notSetUp.count()) > 0,
    "the demo backend has no VAPID keys (push_not_set_up)",
  );

  const toggle = alertSwitch(page);
  await expect(toggle).not.toBeChecked();

  // Off to On: permission asked, subscribed, accepted by the backend.
  await toggle.click();
  await expect(page.getByText("On", { exact: true })).toBeVisible();
  await expect(toggle).toBeChecked();

  // The backend kept it: after a reload the card is On from the stored id AND the stubbed subscription.
  await page.reload();
  await expect(page.getByText("On", { exact: true })).toBeVisible();
  await expect(alertSwitch(page)).toBeChecked();

  // On to Off: unsubscribed in the browser and ended on the backend.
  await alertSwitch(page).click();
  await expect(page.getByText("Off", { exact: true })).toBeVisible();
  await expect(alertSwitch(page)).not.toBeChecked();
  await page.reload();
  await expect(page.getByText("Off", { exact: true })).toBeVisible();

  const wide = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(wide).toBeLessThanOrEqual(0);
  errors.expectNone();
});
