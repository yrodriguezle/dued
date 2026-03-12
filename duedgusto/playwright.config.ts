import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for visual regression testing.
 * Uses only Chromium with 3 viewport sizes: mobile, tablet, desktop.
 *
 * Run with:
 *   npm run test:visual          — run visual regression tests
 *   npm run test:visual:update   — update baseline snapshots
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  snapshotDir: "./e2e/snapshots",

  /* Maximum time one test can run */
  timeout: 30_000,

  /* Expect configuration for screenshot comparison */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Reporter */
  reporter: process.env.CI ? "github" : "html",

  /* Shared settings for all the projects below */
  use: {
    baseURL: "http://localhost:4001",
    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",
    /* Screenshot on failure */
    screenshot: "only-on-failure",
  },

  /* Configure projects: auth setup + 3 viewport sizes */
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
      },
      dependencies: ["setup"],
    },
    {
      name: "tablet",
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
      },
      dependencies: ["setup"],
    },
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
      },
      dependencies: ["setup"],
    },
  ],

  /* Start the dev server if not already running */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4001",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
