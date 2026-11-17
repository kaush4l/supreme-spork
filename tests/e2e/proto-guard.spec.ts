import { expect, test } from "@playwright/test";

// V16: disabled routes answer 404; enabled routes make zero live service calls (network log).
// PROTO_OFF_URL points at a server started WITHOUT PROTO_ENABLED (see phase-2 README).
const PERSONAS = [
  "owner",
  "partner",
  "manager-money",
  "manager",
  "staff",
  "bookkeeper",
  "multi",
];
const ROUTES = [
  "home",
  "inbox",
  "me",
  "team",
  "team/roster",
  "money",
  "money/dockets",
  "operations",
  "shifts",
];

test("enabled: every persona/route loads with no off-origin or non-GET requests", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL as string).origin;
  const seen: { url: string; method: string }[] = [];
  page.on("request", (r) => seen.push({ url: r.url(), method: r.method() }));
  await page.goto("/proto");
  await expect(page.getByText(/sample data/i).first()).toBeVisible();
  for (const p of PERSONAS) {
    for (const r of ROUTES) {
      await page.goto(`/proto/${p}/${r}`);
      await expect(page.getByText(/sample data/i).first()).toBeVisible();
    }
  }
  const offOrigin = seen.filter((s) => !s.url.startsWith(origin));
  expect(offOrigin, JSON.stringify(offOrigin)).toEqual([]);
  const writes = seen.filter((s) => s.method !== "GET");
  expect(writes, JSON.stringify(writes)).toEqual([]);
  const nonProto = seen.filter((s) => {
    const path = new URL(s.url).pathname;
    return (
      !path.startsWith("/proto") &&
      !path.startsWith("/_next/") &&
      !/^\/(favicon\.ico|icon-.*\.png)$/.test(path)
    );
  });
  expect(nonProto, JSON.stringify(nonProto)).toEqual([]);
});

test("disabled: /proto routes are 404", async ({ request }) => {
  const off = process.env.PROTO_OFF_URL;
  test.skip(!off, "PROTO_OFF_URL not set");
  for (const path of [
    "/proto",
    "/proto/owner/home",
    "/proto/staff/inbox",
    "/proto/bogus",
  ]) {
    const res = await request.get(`${off}${path}`, { maxRedirects: 0 });
    expect(res.status(), path).toBe(404);
  }
});
