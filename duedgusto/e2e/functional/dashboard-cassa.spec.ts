import { test, expect, Page } from "@playwright/test";
import { waitForPageReady } from "./helpers";

/**
 * Smoke test E2E per la Dashboard Cassa ridisegnata (change dashboard-charts-redesign).
 *
 * Copre:
 *   - caricamento senza errori console / eccezioni non gestite (guardia recharts#6857);
 *   - sezioni visibili: hero KPI, Flusso di cassa (Sankey lazy o fallback barre
 *     impilate: stesso titolo), Distribuzione incassi (donut), Trend mensile;
 *   - periodo iniziale sul mese precedente e cambio mese/anno dall'header.
 *
 * Nota: se l'anno non ha registri la dashboard mostra l'empty state al posto
 * dei grafici (comportamento da spec): le asserzioni accettano entrambi i casi.
 */

/** Errori console benigni da ignorare (licenza AG Grid, risorse esterne). */
const IGNORED_CONSOLE_PATTERNS = [/ag grid/i, /license/i, /favicon/i, /net::ERR/i, /Failed to load resource/i];

const MESI_LABEL = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

/** Periodo di default della dashboard: il mese precedente a oggi. */
function periodoIniziale(): { anno: number; mese: number } {
  const oggi = new Date();
  const riferimento = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
  return { anno: riferimento.getFullYear(), mese: riferimento.getMonth() + 1 };
}

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
    await expect(page.getByLabel("Mese")).toBeVisible();
    await expect(page.getByLabel("Anno")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuova Cassa" })).toBeVisible();

    // Periodo iniziale: mese precedente (l'ultimo mese completo), non il mese in corso
    const { anno: annoRiferimento, mese: meseRiferimento } = periodoIniziale();
    await expect(page.getByLabel("Mese")).toHaveText(MESI_LABEL[meseRiferimento - 1]);
    await expect(page.getByLabel("Anno")).toHaveText(String(annoRiferimento));

    const emptyState = page.getByText(`Nessun registro per il ${annoRiferimento}`);
    const hasData = !(await emptyState.isVisible().catch(() => false));

    if (hasData) {
      // Sezioni della griglia: flusso (Sankey o fallback), donut, trend
      await expect(page.getByText(`Flusso di cassa ${annoRiferimento}`)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Distribuzione incassi")).toBeVisible();
      await expect(page.getByText(`Trend mensile ${annoRiferimento}`)).toBeVisible();
      // Totali annuali nella sezione hero
      await expect(page.getByText(`Totali ${annoRiferimento}`)).toBeVisible();
    } else {
      // Empty state esplicito con CTA (nessun grafico rotto)
      await expect(emptyState).toBeVisible();
    }

    // Guardia recharts#6857: nessun errore console / eccezione non gestita
    expect(consoleErrors).toEqual([]);
  });

  test("cambio anno aggiorna i contenuti", async ({ page }) => {
    await gotoDashboard(page);

    const { anno: annoRiferimento } = periodoIniziale();
    const annoPrecedente = annoRiferimento - 1;

    await page.getByLabel("Anno").click();
    await page.getByRole("option", { name: String(annoPrecedente) }).click();
    await waitForPageReady(page);

    // Con dati: sezioni intestate sull'anno selezionato; senza dati: empty state dell'anno
    const contenutoAggiornato = page
      .getByText(`Trend mensile ${annoPrecedente}`)
      .or(page.getByText(`Nessun registro per il ${annoPrecedente}`));
    await expect(contenutoAggiornato.first()).toBeVisible({ timeout: 15_000 });

    // Nessun residuo dell'anno di partenza nelle intestazioni delle sezioni
    await expect(page.getByText(`Trend mensile ${annoRiferimento}`)).toHaveCount(0);
  });

  test("cambio mese aggiorna i KPI del periodo", async ({ page }) => {
    await gotoDashboard(page);

    const { anno: annoRiferimento } = periodoIniziale();
    // Empty state dell'anno → nessun hero KPI da verificare
    const emptyState = page.getByText(`Nessun registro per il ${annoRiferimento}`);
    if (await emptyState.isVisible().catch(() => false)) return;

    await page.getByLabel("Mese").click();
    await page.getByRole("option", { name: "Marzo" }).click();
    await waitForPageReady(page);

    // Intestazione hero sul mese scelto: con dati i KPI, senza dati il messaggio esplicito
    await expect(page.getByText(`KPI di Marzo ${annoRiferimento}`)).toBeVisible({ timeout: 15_000 });
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
