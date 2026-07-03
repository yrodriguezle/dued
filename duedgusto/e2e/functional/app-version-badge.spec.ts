import { test, expect, Page } from "@playwright/test";
import { waitForPageReady } from "./helpers";

/**
 * Test E2E per il badge versione app nella toolbar.
 *
 * Comportamento atteso:
 *   - Sidebar aperta: versione visibile in fondo alla sidebar, badge in toolbar nascosto
 *   - Sidebar chiusa: badge visibile sotto il logo nella toolbar
 *
 * Il badge mostra "v" + la versione compilata nel bundle (__APP_VERSION__).
 */

const OPEN_LABEL = "Apri menu di navigazione";
const CLOSE_LABEL = "Chiudi menu di navigazione";

/** Porta la sidebar nello stato desiderato usando il pulsante toggle. */
async function setDrawerOpen(page: Page, open: boolean): Promise<void> {
  const targetLabel = open ? OPEN_LABEL : CLOSE_LABEL;
  const toggle = page.getByLabel(targetLabel);
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    // Attende la transizione del drawer (0.3s) e il cambio di aria-label
    await expect(page.getByLabel(open ? CLOSE_LABEL : OPEN_LABEL)).toBeVisible();
  }
}

test.describe("Badge versione app in toolbar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gestionale", { waitUntil: "domcontentloaded" });
    await waitForPageReady(page);
  });

  test("con sidebar aperta la versione appare nella sidebar e il badge è nascosto", async ({ page }) => {
    await setDrawerOpen(page, true);

    await expect(page.getByTestId("sidebar-app-version")).toBeVisible();
    await expect(page.getByTestId("sidebar-app-version")).toHaveText(/^v\d+\.\d+\.\d+/);
    await expect(page.getByTestId("app-version-badge")).toHaveCount(0);
  });

  test("chiudendo la sidebar il badge versione appare sotto il logo", async ({ page }) => {
    await setDrawerOpen(page, false);

    const badge = page.getByTestId("app-version-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/^v\d+\.\d+\.\d+/);
  });

  test("il badge è allineato sotto il titolo del logo", async ({ page }) => {
    await setDrawerOpen(page, false);

    const badge = page.getByTestId("app-version-badge");
    await expect(badge).toBeVisible();

    // Il titolo del logo è l'heading h1 (LogoSection)
    const logoTitle = page.getByRole("heading", { level: 1 });
    const titleBox = await logoTitle.boundingBox();
    const badgeBox = await badge.boundingBox();

    expect(titleBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    // Il badge sta sotto il testo del titolo
    expect(badgeBox!.y).toBeGreaterThan(titleBox!.y);
    // e non sporge oltre il bordo destro del titolo
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(titleBox!.x + titleBox!.width + 1);
  });

  test("riaprendo la sidebar il badge scompare", async ({ page }) => {
    await setDrawerOpen(page, false);
    await expect(page.getByTestId("app-version-badge")).toBeVisible();

    await setDrawerOpen(page, true);
    await expect(page.getByTestId("app-version-badge")).toHaveCount(0);
    await expect(page.getByTestId("sidebar-app-version")).toBeVisible();
  });
});
