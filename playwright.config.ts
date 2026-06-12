import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:4815",
  },
  webServer: {
    command: "npm run build && npm run start -- -p 4815",
    url: "http://localhost:4815",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
