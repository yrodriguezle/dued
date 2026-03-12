import { test as setup } from "@playwright/test";
import { AUTH_STATE_PATH } from "./helpers";
import fs from "fs";
import path from "path";

/**
 * Authentication setup script.
 *
 * This test logs in via the sign-in page and stores the authentication state
 * (cookies + localStorage) to a file that other tests can reuse.
 *
 * Run this ONCE before running visual regression tests:
 *   npx playwright test e2e/visual-regression/auth.setup.ts
 *
 * Prerequisites:
 *   - Backend running on https://0.0.0.0:4000
 *   - Frontend running on http://localhost:4001
 *   - Valid user credentials (update USERNAME and PASSWORD below)
 */

const USERNAME = process.env.TEST_USERNAME || "superadmin";
const PASSWORD = process.env.TEST_PASSWORD || "Du3*gust0-2025";

setup("authenticate", async ({ page }) => {
  // Ensure the .auth directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Navigate to sign-in page
  await page.goto("/signin");

  // Fill in credentials matching the actual sign-in form labels
  await page.getByLabel("Nome utente").fill(USERNAME);
  await page.getByLabel("Password").fill(PASSWORD);

  // Submit the form
  await page.getByRole("button", { name: "Accedi" }).click();

  // Wait for navigation to the gestionale (authenticated area)
  await page.waitForURL("**/gestionale/**", { timeout: 15_000 });

  // Store the authenticated state
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
