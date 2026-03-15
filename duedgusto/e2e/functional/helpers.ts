import { Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the stored authentication state file.
 * Condiviso con e2e/visual-regression/helpers.ts per riusare lo stesso file di auth.
 *
 * Generato da e2e/functional/auth.setup.ts oppure da e2e/visual-regression/auth.setup.ts.
 */
export const AUTH_STATE_PATH = path.join(__dirname, "..", ".auth", "storageState.json");

/**
 * Timeout predefinito per attesa contenuto pagina (ms).
 */
export const CONTENT_LOAD_TIMEOUT = 15_000;

/**
 * Timeout per operazioni di ricerca nel Searchbox (ms).
 * Include il debounce di 300ms + latenza di rete.
 */
export const SEARCHBOX_QUERY_TIMEOUT = 5_000;

/**
 * Attende che la pagina sia carica e stabile.
 * Aspetta networkidle e la scomparsa degli spinner MUI e dei Suspense fallback.
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: CONTENT_LOAD_TIMEOUT });

  const spinner = page.locator('[role="progressbar"]');
  if ((await spinner.count()) > 0) {
    await spinner.first().waitFor({ state: "hidden", timeout: CONTENT_LOAD_TIMEOUT });
  }

  const fallback = page.locator('[data-testid="route-fallback"]');
  if ((await fallback.count()) > 0) {
    await fallback.first().waitFor({ state: "hidden", timeout: CONTENT_LOAD_TIMEOUT });
  }
}

/**
 * Naviga a una pagina nel gestionale e attende che sia pronta.
 *
 * @param page - Oggetto page di Playwright
 * @param routePath - Percorso relativo a /gestionale/ (es. "fatture-acquisto-details")
 */
export async function navigateAndWait(page: Page, routePath: string): Promise<void> {
  await page.goto(`/gestionale/${routePath}`, { waitUntil: "domcontentloaded" });
  await waitForPageReady(page);
}

/**
 * Localizza il campo input di un Searchbox tramite il suo label MUI.
 *
 * Il Searchbox renderizza un MUI TextField con label. Playwright trova
 * l'input tramite getByLabel che usa l'associazione label/input di MUI.
 *
 * @param page - Oggetto page di Playwright
 * @param label - Il testo del label del campo (es. "Fornitore *")
 */
export function getSearchboxInput(page: Page, label: string) {
  return page.getByLabel(label);
}

/**
 * Digita testo in un Searchbox e attende che il dropdown diventi visibile.
 *
 * @param page - Oggetto page di Playwright
 * @param label - Il testo del label del campo Searchbox
 * @param text - Il testo da digitare
 */
export async function typeInSearchbox(page: Page, label: string, text: string): Promise<void> {
  const input = getSearchboxInput(page, label);
  await input.click();
  await input.fill(text);
}

/**
 * Attende che il dropdown dei risultati del Searchbox sia visibile.
 * Il dropdown e' un Paper MUI con position absolute che contiene la griglia AG Grid
 * oppure il messaggio "Nessun risultato trovato".
 *
 * @param page - Oggetto page di Playwright
 */
export async function waitForSearchboxDropdown(page: Page): Promise<void> {
  // Il dropdown e' il primo Paper elevation=8 con position:absolute visibile dopo un TextField
  // Usiamo il testo "Nessun risultato trovato" oppure la griglia AG Grid (.ag-root-wrapper)
  await page
    .locator(".ag-root-wrapper, text=Nessun risultato trovato")
    .first()
    .waitFor({ state: "visible", timeout: SEARCHBOX_QUERY_TIMEOUT });
}

/**
 * Conta le righe visibili nella griglia AG Grid del dropdown Searchbox.
 * Conta solo le righe dati (non le righe di loading o overlay).
 *
 * @param page - Oggetto page di Playwright
 */
export async function countSearchboxResults(page: Page): Promise<number> {
  // AG Grid renderizza le righe dati come div con classe ag-row
  // Le righe di loading hanno classe ag-row-loading, escludiamo quelle
  return page.locator(".ag-row:not(.ag-row-loading)").count();
}

/**
 * Verifica se il messaggio "Nessun risultato trovato" e' visibile.
 *
 * @param page - Oggetto page di Playwright
 */
export async function isNoResultsMessageVisible(page: Page): Promise<boolean> {
  const msg = page.getByText("Nessun risultato trovato");
  return msg.isVisible();
}

/**
 * Verifica se il dropdown del Searchbox e' visibile (contiene griglia o messaggio).
 *
 * @param page - Oggetto page di Playwright
 */
export async function isSearchboxDropdownVisible(page: Page): Promise<boolean> {
  const grid = page.locator(".ag-root-wrapper").first();
  const noResults = page.getByText("Nessun risultato trovato");

  const gridVisible = await grid.isVisible().catch(() => false);
  const noResultsVisible = await noResults.isVisible().catch(() => false);

  return gridVisible || noResultsVisible;
}
