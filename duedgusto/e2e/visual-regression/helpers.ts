import { Page, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the stored authentication state file.
 * This file contains cookies and localStorage entries (JWT tokens)
 * needed to bypass the login flow in tests.
 *
 * Generate it by running:
 *   npx playwright test e2e/visual-regression/auth.setup.ts
 *
 * Or manually create it with the correct JWT + refresh token cookie.
 */
export const AUTH_STATE_PATH = path.join(__dirname, "..", ".auth", "storageState.json");

/**
 * Default timeout for waiting on page content to load (ms).
 */
const CONTENT_LOAD_TIMEOUT = 10_000;

/**
 * Wait for the page to be fully loaded and stable before taking a screenshot.
 * This waits for network idle and ensures no loading spinners are visible.
 */
export async function waitForPageReady(page: Page): Promise<void> {
  // Wait for network to settle
  await page.waitForLoadState("networkidle", { timeout: CONTENT_LOAD_TIMEOUT });

  // Wait for any MUI circular progress spinners to disappear
  const spinner = page.locator('[role="progressbar"]');
  if ((await spinner.count()) > 0) {
    await spinner.first().waitFor({ state: "hidden", timeout: CONTENT_LOAD_TIMEOUT });
  }

  // Wait for any Suspense fallbacks to disappear
  const fallback = page.locator('[data-testid="route-fallback"]');
  if ((await fallback.count()) > 0) {
    await fallback.first().waitFor({ state: "hidden", timeout: CONTENT_LOAD_TIMEOUT });
  }
}

/**
 * Take a full-page screenshot with a consistent naming convention.
 *
 * @param page - Playwright page object
 * @param name - Screenshot name (will be combined with project name automatically by Playwright)
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: "disabled",
  });
}

/**
 * Navigate to a page within the gestionale section and wait for it to be ready.
 *
 * @param page - Playwright page object
 * @param routePath - The path relative to /gestionale/ (e.g., "settings", "users-list")
 */
export async function navigateAndWait(page: Page, routePath: string): Promise<void> {
  await page.goto(`/gestionale/${routePath}`, { waitUntil: "domcontentloaded" });
  await waitForPageReady(page);
}

/**
 * Navigate to a page and take a visual regression screenshot.
 * Combines navigateAndWait + takeScreenshot for convenience.
 *
 * @param page - Playwright page object
 * @param routePath - The path relative to /gestionale/
 * @param screenshotName - Name for the screenshot file
 */
export async function visualTest(page: Page, routePath: string, screenshotName: string): Promise<void> {
  await navigateAndWait(page, routePath);
  await takeScreenshot(page, screenshotName);
}
