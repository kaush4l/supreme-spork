import { defineConfig } from "@playwright/test";

// Runs against the production build (`bun run build` first). Locally the installed Chrome is used
// (PW_CHANNEL=chrome); CI downloads Chromium (`bunx playwright install --with-deps chromium`).
const port = Number(process.env.E2E_PORT ?? 3111);
// E2E_BASE_URL points the tests at a server that is already running (for example `bun run dev` on :3000).
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    channel: process.env.PW_CHANNEL || undefined,
  },
  workers: external ? 3 : undefined,
  retries: external ? 1 : 0, // live runs share demo data; one retry absorbs a timing collision
  timeout: external ? 60_000 : 30_000,
  webServer: external
    ? undefined
    : {
        command: `bun run start`,
        env: { PORT: String(port) },
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
