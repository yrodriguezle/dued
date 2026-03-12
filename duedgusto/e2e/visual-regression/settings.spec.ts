import { test } from "@playwright/test";
import { visualTest, AUTH_STATE_PATH } from "./helpers";

/**
 * Visual regression tests for Settings pages.
 *
 * Covers:
 * - BusinessSettingsForm
 * - OperatingDaysSection
 * - OperatingHoursSection
 *
 * All three are rendered together inside SettingsDetails,
 * accessible at /gestionale/settings.
 */

test.use({ storageState: AUTH_STATE_PATH });

test.describe("Settings Page", () => {
  test("settings page — full view", async ({ page }) => {
    await visualTest(page, "settings", "settings-full");
  });

  test("settings page — business settings section", async ({ page }) => {
    await page.goto("/gestionale/settings", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Scroll to ensure BusinessSettingsForm is visible
    const businessSection = page.locator("form").first();
    if (await businessSection.isVisible()) {
      await businessSection.scrollIntoViewIfNeeded();
    }

    await visualTest(page, "settings", "settings-business-form");
  });

  test("settings page — operating days section", async ({ page }) => {
    await page.goto("/gestionale/settings", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Scroll to operating days section if visible
    const daysSection = page.getByText(/giorni operativ/i).first();
    if (await daysSection.isVisible()) {
      await daysSection.scrollIntoViewIfNeeded();
    }

    await visualTest(page, "settings", "settings-operating-days");
  });

  test("settings page — operating hours section", async ({ page }) => {
    await page.goto("/gestionale/settings", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Scroll to operating hours section if visible
    const hoursSection = page.getByText(/orari operativ/i).first();
    if (await hoursSection.isVisible()) {
      await hoursSection.scrollIntoViewIfNeeded();
    }

    await visualTest(page, "settings", "settings-operating-hours");
  });
});
