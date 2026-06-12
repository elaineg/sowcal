import { defineConfig } from "@playwright/test";

// Set E2E_BASE_URL to run the suite against a deployed URL (preview/prod).
// Without it, Playwright builds and serves the app locally on :4815.
const baseURL = process.env.E2E_BASE_URL || "http://localhost:4815";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start -- -p 4815",
        url: "http://localhost:4815",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
