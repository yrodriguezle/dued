import { test, Page } from "@playwright/test";
import { navigateAndWait, takeScreenshot, AUTH_STATE_PATH } from "./helpers";

/**
 * Visual regression per la Dashboard Cassa ridisegnata
 * (change dashboard-charts-redesign): screenshot in dark e light mode.
 *
 * La dashboard è la pagina indice del gestionale (HomePage →
 * RegistrazioneCassDashboard): hero KPI Differenza + banda densa,
 * Sankey flusso di cassa (lazy), donut distribuzione incassi, trend mensile.
 */

test.use({ storageState: AUTH_STATE_PATH });

/** Tempo di assestamento delle animazioni interne dei grafici (x-charts/recharts). */
const CHART_SETTLE_MS = 1_000;

/** Seleziona il tema dal menu della header bar (aria-label "Tema"). */
async function setTheme(page: Page, label: "Chiaro" | "Oscuro"): Promise<void> {
  await page.getByLabel("Tema").click();
  await page.getByRole("menuitem", { name: label }).click();
  // Attende l'applicazione del tema e il repaint dei grafici
  await page.waitForTimeout(CHART_SETTLE_MS);
}

test.describe("Dashboard Cassa — visual", () => {
  test("dashboard cassa — light mode", async ({ page }) => {
    await navigateAndWait(page, "");
    await setTheme(page, "Chiaro");
    await takeScreenshot(page, "dashboard-cassa-light");
  });

  test("dashboard cassa — dark mode", async ({ page }) => {
    await navigateAndWait(page, "");
    await setTheme(page, "Oscuro");
    await takeScreenshot(page, "dashboard-cassa-dark");
  });
});
