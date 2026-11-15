import { defineConfig } from "@playwright/test";

// Runs against the production build (`bun run build` first). Locally the installed Chrome is used
// (PW_CHANNEL=chrome); CI downloads Chromium (`bunx playwright install --with-deps chromium`).
const port = Number(process.env.E2E_PORT ?? 3111);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: {
    command: `bun run start`,
    env: { PORT: String(port) },
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
