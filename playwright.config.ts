import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
// Local runs use the labelled fictional demonstration (`--mode fixture`), so they spend no live quota.
// Set E2E_LIVE=1 to run the local build with the credentials in `.dev.vars` instead.
const MODE = process.env.E2E_LIVE ? "" : " --mode fixture";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // The production build runs in workerd through the Vite Cloudflare plugin, with a local D1.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx vite build${MODE} && npx wrangler d1 migrations apply room-for-both --local && npx vite preview${MODE} --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
