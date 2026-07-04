import { test, expect, Page } from "@playwright/test";
import { waitForPageReady } from "./helpers";

/**
 * Smoke test E2E per la Dashboard Cassa ridisegnata (change dashboard-charts-redesign).
 *
 * Copre:
 *   - caricamento senza errori console / eccezioni non gestite (guardia recharts#6857);
 *   - sezioni visibili: hero KPI, Flusso di cassa (Sankey lazy o fallback barre
 *     impilate: stesso titolo), Distribuzione incassi (donut), Trend mensile;
 *   - cambio anno: i contenuti si aggiornano sull'anno selezionato.
 *
 * Nota: se l'anno non ha registri la dashboard mostra l'empty state al posto
 * dei grafici (comportamento da spec): le asserzioni accettano entrambi i casi.
 */

/** Errori console benigni da ignorare (licenza AG Grid, risorse esterne). */
const IGNORED_CONSOLE_PATTERNS = [/ag grid/i, /license/i, /favicon/i, /net::ERR/i, /Failed to load resource/i];

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(message.text()))) {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`Uncaught: ${error.message}`);
  });
  return errors;
}

async function gotoDashboard(page: Page): Promise<void> {
  await page.goto("/gestionale", { waitUntil: "domcontentloaded" });
  await waitForPageReady(page);
}

test.describe("Dashboard Cassa — smoke", () => {
  test("carica senza errori console e mostra header e sezioni", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    await gotoDashboard(page);

    // Header sempre visibile e interattivo
    await expect(page.getByRole("heading", { name: "Dashboard Cassa" }).or(page.getByText("Dashboard Cassa").first())).toBeVisible();
    await expect(page.getByLabel("Anno")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuova Cassa" })).toBeVisible();

    const annoCorrente = new Date().getFullYear();
    const emptyState = page.getByText(`Nessun registro per il ${annoCorrente}`);
    const hasData = !(await emptyState.isVisible().catch(() => false));

    if (hasData) {
      // Sezioni della griglia: flusso (Sankey o fallback), donut, trend
      await expect(page.getByText(`Flusso di cassa ${annoCorrente}`)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Distribuzione incassi")).toBeVisible();
      await expect(page.getByText(`Trend mensile ${annoCorrente}`)).toBeVisible();
      // Totali annuali nella sezione hero
      await expect(page.getByText(`Totali ${annoCorrente}`)).toBeVisible();
    } else {
      // Empty state esplicito con CTA (nessun grafico rotto)
      await expect(emptyState).toBeVisible();
    }

    // Guardia recharts#6857: nessun errore console / eccezione non gestita
    expect(consoleErrors).toEqual([]);
  });

  test("cambio anno aggiorna i contenuti", async ({ page }) => {
    await gotoDashboard(page);

    const annoCorrente = new Date().getFullYear();
    const annoPrecedente = annoCorrente - 1;

    await page.getByLabel("Anno").click();
    await page.getByRole("option", { name: String(annoPrecedente) }).click();
    await waitForPageReady(page);

    // Con dati: sezioni intestate sull'anno selezionato; senza dati: empty state dell'anno
    const contenutoAggiornato = page
      .getByText(`Trend mensile ${annoPrecedente}`)
      .or(page.getByText(`Nessun registro per il ${annoPrecedente}`));
    await expect(contenutoAggiornato.first()).toBeVisible({ timeout: 15_000 });

    // Nessun residuo dell'anno corrente nelle intestazioni delle sezioni
    await expect(page.getByText(`Trend mensile ${annoCorrente}`)).toHaveCount(0);
  });

  test("nessuno scroll orizzontale a livello di pagina", async ({ page }) => {
    await gotoDashboard(page);

    const overflow = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
    }));
    expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.bodyClientWidth);
  });
});
