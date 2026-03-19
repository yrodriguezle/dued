import { test, expect } from "@playwright/test";
import {
  getSearchboxInput,
  typeInSearchbox,
  waitForSearchboxDropdown,
  countSearchboxResults,
  SEARCHBOX_QUERY_TIMEOUT,
} from "./helpers";

/**
 * Test E2E funzionali: filtraggio progressivo del Searchbox.
 *
 * Coprono:
 * - REQ-E2E-001: Flusso completo ricerca e selezione
 * - REQ-E2E-002: Filtraggio progressivo (ogni carattere aggiuntivo produce <= risultati)
 *
 * Prerequisiti:
 *   - Backend running su https://0.0.0.0:4000
 *   - Frontend running su http://localhost:4001
 *   - Almeno 3-4 fornitori nel database con nomi diversi
 *   - Lo storageState di autenticazione deve essere presente (.auth/storageState.json)
 *     Eseguire prima: npx playwright test e2e/functional/auth.setup.ts --project=functional-setup
 *
 * La pagina di test usata e' "fatture-acquisto-details" (FatturaAcquistoDetails.tsx)
 * che contiene un FormikSearchbox con label "Fornitore *" e fieldName="ragioneSociale".
 */

/**
 * Pagina che contiene un Searchbox fornitore.
 * Il path esatto dipende dalla configurazione menu nel database.
 * Basato sul navigate() in FatturaAcquistoDetails.tsx:
 *   navigate(`/gestionale/fatture-acquisto-details?invoiceId=...`)
 * Per la pagina "new" (senza invoiceId) usiamo il path della lista o del dettaglio senza params.
 */
const FORNITORE_SEARCHBOX_LABEL = "Fornitore *";

/**
 * Pagine candidate che contengono un Searchbox fornitore.
 * Le proviamo in ordine finche' una funziona (dipende dalla configurazione menu nel DB).
 */
const CANDIDATE_PAGES = [
  "fatture-acquisto-details",
  "purchases/new",
  "delivery-notes/new",
  "documenti-trasporto-details",
];

/**
 * Naviga alla prima pagina con Searchbox fornitore disponibile.
 * Restituisce il path della pagina trovata.
 */
async function navigateToPageWithFornitoreSearchbox(page: import("@playwright/test").Page): Promise<string> {
  for (const candidate of CANDIDATE_PAGES) {
    await page.goto(`/gestionale/${candidate}`, { waitUntil: "domcontentloaded" });

    // Verifica che la pagina abbia caricato qualcosa di significativo (non solo un redirect)
    const currentUrl = page.url();
    if (!currentUrl.includes("/signin") && !currentUrl.includes("404")) {
      // Cerca il campo Searchbox fornitore
      const searchboxInput = page.getByLabel(FORNITORE_SEARCHBOX_LABEL);
      const found = await searchboxInput.isVisible({ timeout: 5_000 }).catch(() => false);
      if (found) {
        return candidate;
      }
    }
  }
  // Se nessuna pagina candidata funziona, usa la prima e lascia che il test fallisca con un messaggio chiaro
  return CANDIDATE_PAGES[0];
}

test.describe("Searchbox - Filtraggio progressivo (REQ-E2E-001, REQ-E2E-002)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPageWithFornitoreSearchbox(page);
  });

  /**
   * REQ-E2E-001 - Scenario: E2E - Ricerca e dropdown
   *
   * Digitare una lettera nel Searchbox fornitore deve far apparire il dropdown con risultati.
   */
  test("digitare nel searchbox mostra il dropdown con risultati", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Digita una lettera comune (presente nella maggior parte dei nomi fornitore)
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");

    // Attende che appaia la griglia oppure il messaggio di nessun risultato
    await waitForSearchboxDropdown(page);

    // Il dropdown deve essere visibile
    const agGrid = page.locator(".ag-root-wrapper").first();
    const noResults = page.getByText("Nessun risultato trovato");

    const gridVisible = await agGrid.isVisible({ timeout: SEARCHBOX_QUERY_TIMEOUT }).catch(() => false);
    const noResultsVisible = await noResults.isVisible({ timeout: 1_000 }).catch(() => false);

    expect(gridVisible || noResultsVisible).toBe(true);
  });

  /**
   * REQ-E2E-002 - Scenario: I risultati diminuiscono progressivamente
   *
   * Ogni carattere aggiuntivo digitato deve produrre un numero di risultati
   * <= al numero precedente (mai superiore).
   */
  test("ogni carattere aggiuntivo non aumenta i risultati (filtraggio progressivo)", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Prima lettera: ottieni il numero iniziale di risultati
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");
    await waitForSearchboxDropdown(page);

    // Breve attesa per garantire che la griglia sia popolata dopo il debounce (300ms)
    await page.waitForTimeout(600);

    const countAfterFirstChar = await countSearchboxResults(page);

    // Seconda lettera: aggiungi "n" -> "an"
    await input.press("End");
    await input.type("n");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    const countAfterSecondChar = await countSearchboxResults(page);

    // Terza lettera: aggiungi "a" -> "ana"
    await input.press("End");
    await input.type("a");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    const countAfterThirdChar = await countSearchboxResults(page);

    // Ogni step deve avere <= risultati del precedente
    expect(countAfterSecondChar).toBeLessThanOrEqual(countAfterFirstChar);
    expect(countAfterThirdChar).toBeLessThanOrEqual(countAfterSecondChar);
  });

  /**
   * REQ-E2E-002 - Scenario: Parole multiple restringono ulteriormente
   *
   * Digitare una seconda parola (separata da spazio) deve produrre risultati
   * che sono un sottoinsieme dei risultati della prima parola.
   */
  test("aggiungere una seconda parola con spazio restringe ulteriormente i risultati", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Prima parola
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    const countSingleWord = await countSearchboxResults(page);

    if (countSingleWord === 0) {
      // Se non ci sono risultati con "a", salta il test (dati insufficienti)
      test.skip();
      return;
    }

    // Aggiungi spazio e seconda parola -> "a z" (lettera rara per ridurre i risultati)
    await input.press("End");
    await input.type(" z");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    const countTwoWords = await countSearchboxResults(page);

    // I risultati con due parole devono essere <= ai risultati con una parola
    expect(countTwoWords).toBeLessThanOrEqual(countSingleWord);
  });

  /**
   * REQ-E2E-001 - Scenario: E2E - Ricerca e selezione con tastiera (ArrowDown + Enter)
   *
   * Digitare testo, premere ArrowDown per navigare nella griglia, poi Enter per selezionare.
   */
  test("selezione con tastiera (ArrowDown + Enter) seleziona un elemento", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Digita per ottenere risultati
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    const resultCount = await countSearchboxResults(page);

    if (resultCount === 0) {
      // Nessun risultato disponibile: impossibile testare la selezione
      test.skip();
      return;
    }

    // Ottieni il testo della prima riga della griglia prima di premere ArrowDown
    // La prima cella visibile della griglia dovrebbe essere "Ragione Sociale"
    const firstRowCell = page.locator(".ag-row:not(.ag-row-loading)").first().locator(".ag-cell").first();
    const firstRowText = await firstRowCell.textContent().catch(() => "");

    // Preme ArrowDown per spostare il focus alla griglia
    await input.press("ArrowDown");
    await page.waitForTimeout(300);

    // Preme Enter per selezionare la riga
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    // Verifica che il dropdown si sia chiuso
    const agGrid = page.locator(".ag-root-wrapper").first();
    const dropdownVisible = await agGrid.isVisible({ timeout: 1_000 }).catch(() => false);
    expect(dropdownVisible).toBe(false);

    // Verifica che il campo sia stato popolato con qualcosa
    const inputValue = await input.inputValue();
    expect(inputValue.length).toBeGreaterThan(0);

    // Se abbiamo il testo della prima riga, verifica che l'input corrisponda
    if (firstRowText && firstRowText.trim().length > 0) {
      expect(inputValue.toLowerCase()).toContain(firstRowText.trim().toLowerCase().substring(0, 3));
    }
  });
});

test.describe("Searchbox - Cancellazione e reset (REQ-E2E-001)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPageWithFornitoreSearchbox(page);
  });

  /**
   * REQ-E2E-001 - Il dropdown si chiude quando si cancella il testo
   */
  test("cancellare il testo nasconde il dropdown", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Digita per aprire il dropdown
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    // Cancella tutto il testo
    await input.selectAll();
    await input.press("Delete");
    await page.waitForTimeout(300);

    // Il dropdown deve essere nascosto
    const agGrid = page.locator(".ag-root-wrapper").first();
    const noResults = page.getByText("Nessun risultato trovato");

    const gridVisible = await agGrid.isVisible({ timeout: 1_000 }).catch(() => false);
    const noResultsVisible = await noResults.isVisible({ timeout: 1_000 }).catch(() => false);

    expect(gridVisible || noResultsVisible).toBe(false);
  });
});
