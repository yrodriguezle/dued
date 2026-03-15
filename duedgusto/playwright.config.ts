import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for visual regression and functional testing.
 *
 * Projects:
 *   - setup             — shared auth setup (visual-regression)
 *   - functional-setup  — shared auth setup (functional tests)
 *   - mobile/tablet/desktop — visual regression tests (depend on "setup")
 *   - functional        — functional E2E tests (depend on "functional-setup")
 *
 * Run with:
 *   npm run test:visual           — run visual regression tests
 *   npm run test:visual:update    — update baseline snapshots
 *   npx playwright test e2e/functional/ — run functional E2E tests
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

  /* Configure projects: auth setup + 3 viewport sizes + functional */
  projects: [
    /* --- Visual regression auth setup --- */
    {
      name: "setup",
      testMatch: /visual-regression\/auth\.setup\.ts/,
    },

    /* --- Visual regression tests --- */
    {
      name: "mobile",
      testMatch: /visual-regression\/.*\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
      },
      dependencies: ["setup"],
    },
    {
      name: "tablet",
      testMatch: /visual-regression\/.*\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
      },
      dependencies: ["setup"],
    },
    {
      name: "desktop",
      testMatch: /visual-regression\/.*\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
      },
      dependencies: ["setup"],
    },

    /* --- Functional E2E auth setup --- */
    {
      name: "functional-setup",
      testMatch: /functional\/auth\.setup\.ts/,
    },

    /* --- Functional E2E tests (desktop only) --- */
    {
      name: "functional",
      testMatch: /functional\/.*\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
        storageState: "./e2e/.auth/storageState.json",
      },
      dependencies: ["functional-setup"],
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
