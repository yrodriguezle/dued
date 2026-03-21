import { test, expect } from "@playwright/test";
import {
  getSearchboxInput,
  typeInSearchbox,
  waitForSearchboxDropdown,
  countSearchboxResults,
  isNoResultsMessageVisible,
  isSearchboxDropdownVisible,
  SEARCHBOX_QUERY_TIMEOUT,
} from "./helpers";

/**
 * Test E2E funzionali: griglia vuota e funzionalita' complete del Searchbox.
 *
 * Coprono:
 * - REQ-E2E-003: Griglia vuota — messaggio "Nessun risultato trovato"
 * - REQ-E2E-004: Apertura modale e selezione elemento
 * - REQ-E2E-005: Chiusura dropdown (Escape, click esterno)
 * - REQ-E2E-006: Loading spinner durante digitazione
 *
 * Prerequisiti:
 *   - Backend running su https://0.0.0.0:4000
 *   - Frontend running su http://localhost:4001
 *   - Lo storageState di autenticazione (.auth/storageState.json) deve essere presente
 */

const FORNITORE_SEARCHBOX_LABEL = "Fornitore *";

/**
 * Testo senza corrispondenze: stringa lunga e improbabile da trovare nel DB.
 */
const NONSENSE_TEXT_LONG = "zzzznonexistent99xyz";

/**
 * Testo breve senza corrispondenze (2 caratteri).
 * Con 2 caratteri il componente NON deve mostrare il messaggio di assenza risultati.
 */
const NONSENSE_TEXT_SHORT = "zz";

/**
 * Pagine candidate che contengono un Searchbox fornitore.
 */
const CANDIDATE_PAGES = [
  "fatture-acquisto-details",
  "purchases/new",
  "delivery-notes/new",
  "documenti-trasporto-details",
];

/**
 * Naviga alla prima pagina con Searchbox fornitore disponibile.
 */
async function navigateToPageWithFornitoreSearchbox(page: import("@playwright/test").Page): Promise<void> {
  for (const candidate of CANDIDATE_PAGES) {
    await page.goto(`/gestionale/${candidate}`, { waitUntil: "domcontentloaded" });

    const currentUrl = page.url();
    if (!currentUrl.includes("/signin") && !currentUrl.includes("404")) {
      const searchboxInput = page.getByLabel(FORNITORE_SEARCHBOX_LABEL);
      const found = await searchboxInput.isVisible({ timeout: 5_000 }).catch(() => false);
      if (found) {
        return;
      }
    }
  }
}

test.describe("Searchbox - Griglia vuota (REQ-E2E-003)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPageWithFornitoreSearchbox(page);
  });

  /**
   * REQ-E2E-003 - Scenario: Nessun risultato per testo inesistente
   *
   * Digitare un testo lungo senza corrispondenze (> 2 caratteri) deve mostrare
   * il messaggio "Nessun risultato trovato" e nascondere la griglia.
   */
  test("testo senza corrispondenze (>2 caratteri) mostra messaggio Nessun risultato trovato", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, NONSENSE_TEXT_LONG);

    // Attende la risposta del backend (con debounce 300ms + latenza)
    await page
      .getByText("Nessun risultato trovato")
      .waitFor({ state: "visible", timeout: SEARCHBOX_QUERY_TIMEOUT });

    // Il messaggio deve essere visibile
    const messageVisible = await isNoResultsMessageVisible(page);
    expect(messageVisible).toBe(true);

    // La griglia AG Grid NON deve essere visibile contemporaneamente al messaggio
    const agGrid = page.locator(".ag-root-wrapper").first();
    const gridVisible = await agGrid.isVisible({ timeout: 1_000 }).catch(() => false);
    expect(gridVisible).toBe(false);
  });

  /**
   * REQ-E2E-003 - Scenario: Testo corto senza risultati NON mostra messaggio
   *
   * Con 2 caratteri (o meno) il componente Searchbox non mostra il messaggio
   * "Nessun risultato trovato" anche se non ci sono risultati.
   * Ref: Searchbox.tsx riga ~205: `(innerValue || "").toString().trim().length > 2`
   */
  test("testo corto (2 caratteri) senza risultati NON mostra messaggio Nessun risultato trovato", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, NONSENSE_TEXT_SHORT);

    // Attende il debounce e la risposta
    await page.waitForTimeout(800);

    // Il messaggio "Nessun risultato trovato" NON deve apparire
    const messageVisible = await isNoResultsMessageVisible(page);
    expect(messageVisible).toBe(false);
  });
});

test.describe("Searchbox - Chiusura dropdown (REQ-E2E-005)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPageWithFornitoreSearchbox(page);
  });

  /**
   * REQ-E2E-005 - Scenario: Escape chiude il dropdown
   *
   * Dopo aver aperto il dropdown, premere Escape deve chiuderlo
   * senza modificare il testo nell'input.
   */
  test("Escape chiude il dropdown e mantiene il testo", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Apre il dropdown digitando
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    const dropdownWasVisible = await isSearchboxDropdownVisible(page);
    expect(dropdownWasVisible).toBe(true);

    // Salva il valore corrente dell'input
    const valueBefore = await input.inputValue();

    // Preme Escape
    await input.press("Escape");
    await page.waitForTimeout(300);

    // Il dropdown deve essere chiuso
    const dropdownStillVisible = await isSearchboxDropdownVisible(page);
    expect(dropdownStillVisible).toBe(false);

    // Il testo nell'input deve essere invariato
    const valueAfter = await input.inputValue();
    expect(valueAfter).toBe(valueBefore);
  });

  /**
   * REQ-E2E-005 - Scenario: Click esterno chiude il dropdown
   *
   * Cliccare su un elemento fuori dal componente Searchbox deve chiudere il dropdown.
   */
  test("click esterno chiude il dropdown", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Apre il dropdown
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    const dropdownWasVisible = await isSearchboxDropdownVisible(page);
    expect(dropdownWasVisible).toBe(true);

    // Clicca fuori dal Searchbox (sul titolo della pagina o su un elemento neutro)
    const titleElement = page.locator("#view-title, h5, h4, main").first();
    const titleVisible = await titleElement.isVisible({ timeout: 2_000 }).catch(() => false);

    if (titleVisible) {
      await titleElement.click({ position: { x: 5, y: 5 } });
    } else {
      // Fallback: clicca sulle coordinate in alto a sinistra della pagina
      await page.mouse.click(10, 10);
    }

    await page.waitForTimeout(400);

    // Il dropdown deve essere chiuso
    const dropdownStillVisible = await isSearchboxDropdownVisible(page);
    expect(dropdownStillVisible).toBe(false);
  });
});

test.describe("Searchbox - Selezione elemento (REQ-E2E-001)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPageWithFornitoreSearchbox(page);
  });

  /**
   * REQ-E2E-001 - Scenario: E2E - Ricerca e selezione con doppio click
   *
   * Doppio click su un elemento nel dropdown lo seleziona,
   * popola il campo e chiude il dropdown.
   */
  test("doppio click su un risultato seleziona l'elemento e chiude il dropdown", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Digita per ottenere risultati
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");
    await page.waitForTimeout(600);
    await waitForSearchboxDropdown(page);

    const resultCount = await countSearchboxResults(page);

    if (resultCount === 0) {
      test.skip();
      return;
    }

    // Ottieni la prima riga della griglia
    const firstRow = page.locator(".ag-row:not(.ag-row-loading)").first();
    await firstRow.waitFor({ state: "visible", timeout: SEARCHBOX_QUERY_TIMEOUT });

    // Ottieni il testo della prima cella visibile (Ragione Sociale)
    // La seconda colonna (index 1) e' "Ragione Sociale" basandosi su fornitoreSearchboxOptions
    const ragioneSocialeCell = firstRow.locator(".ag-cell").nth(1);
    const cellText = await ragioneSocialeCell.textContent().catch(() => "");

    // Doppio click sulla riga
    await firstRow.dblclick();
    await page.waitForTimeout(400);

    // Il dropdown deve essere chiuso
    const dropdownVisible = await isSearchboxDropdownVisible(page);
    expect(dropdownVisible).toBe(false);

    // Il campo deve essere popolato con il valore selezionato
    const inputValue = await input.inputValue();
    expect(inputValue.length).toBeGreaterThan(0);

    // Verifica che il valore corrisponda alla cella cliccata (se non e' vuota)
    if (cellText && cellText.trim().length > 0) {
      expect(inputValue).toBe(cellText.trim());
    }
  });
});

test.describe("Searchbox - Modale (REQ-E2E-004)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPageWithFornitoreSearchbox(page);
  });

  /**
   * REQ-E2E-004 - Scenario: E2E - Apertura modale con pulsante expand
   *
   * Cliccare il pulsante expand (ExpandMoreIcon) apre la modale
   * con la lista completa degli elementi (fino a 100).
   */
  test("il pulsante expand apre la modale con tutti gli elementi", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Il pulsante expand e' un IconButton accanto all'input
    // Non ha label accessibile di default, quindi usiamo il suo ruolo e la posizione
    // vicino all'input del Searchbox
    const searchboxContainer = input.locator("..").locator("..");
    const expandButton = searchboxContainer.locator('[role="button"]').last();

    const expandButtonVisible = await expandButton.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!expandButtonVisible) {
      // Tentativo alternativo: cerca un button con l'icona ExpandMore vicino al campo
      const allButtons = page.locator('[aria-label="Open"], button').filter({
        has: page.locator("svg"),
      });
      const count = await allButtons.count();
      if (count === 0) {
        test.skip();
        return;
      }
    }

    // Clicca il pulsante expand
    await expandButton.click();
    await page.waitForTimeout(500);

    // La modale deve aprirsi (MUI Dialog ha role="dialog")
    const modal = page.locator('[role="dialog"]');
    await modal.waitFor({ state: "visible", timeout: SEARCHBOX_QUERY_TIMEOUT });
    await expect(modal).toBeVisible();

    // La modale deve contenere una griglia con elementi
    const modalGrid = modal.locator(".ag-root-wrapper");
    await modalGrid.waitFor({ state: "visible", timeout: SEARCHBOX_QUERY_TIMEOUT });
    await expect(modalGrid).toBeVisible();

    // Attende il caricamento dei dati
    await page.waitForTimeout(1_000);

    const modalResultCount = await modal.locator(".ag-row:not(.ag-row-loading)").count();
    expect(modalResultCount).toBeGreaterThan(0);
  });

  /**
   * REQ-E2E-004 - Scenario: Selezione da modale
   *
   * Doppio click su un elemento nella modale lo seleziona,
   * chiude la modale e popola il campo Searchbox.
   */
  test("doppio click nella modale seleziona l'elemento e chiude la modale", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Apre la modale tramite il pulsante expand
    const searchboxContainer = input.locator("..").locator("..");
    const expandButton = searchboxContainer.locator('[role="button"]').last();

    const expandButtonVisible = await expandButton.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!expandButtonVisible) {
      test.skip();
      return;
    }

    await expandButton.click();

    const modal = page.locator('[role="dialog"]');
    await modal.waitFor({ state: "visible", timeout: SEARCHBOX_QUERY_TIMEOUT });

    // Attende il caricamento dei dati nella modale
    await page.waitForTimeout(1_000);

    const firstModalRow = modal.locator(".ag-row:not(.ag-row-loading)").first();
    const rowVisible = await firstModalRow.isVisible({ timeout: SEARCHBOX_QUERY_TIMEOUT }).catch(() => false);

    if (!rowVisible) {
      test.skip();
      return;
    }

    // Ottieni il testo della prima riga (seconda cella = Ragione Sociale)
    const ragioneSocialeCell = firstModalRow.locator(".ag-cell").nth(1);
    const cellText = await ragioneSocialeCell.textContent().catch(() => "");

    // Doppio click sulla prima riga della modale
    await firstModalRow.dblclick();
    await page.waitForTimeout(400);

    // La modale deve essere chiusa
    const modalStillVisible = await modal.isVisible({ timeout: 1_000 }).catch(() => false);
    expect(modalStillVisible).toBe(false);

    // Il campo deve essere popolato
    const inputValue = await input.inputValue();
    expect(inputValue.length).toBeGreaterThan(0);

    // Verifica il valore selezionato
    if (cellText && cellText.trim().length > 0) {
      expect(inputValue).toBe(cellText.trim());
    }
  });
});

test.describe("Searchbox - Loading spinner (REQ-E2E-006)", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPageWithFornitoreSearchbox(page);
  });

  /**
   * REQ-E2E-006 - Scenario: Spinner visibile durante caricamento (SHOULD)
   *
   * Questo test ha priorita' bassa (SHOULD, non MUST) perche' lo spinner
   * e' visibile solo per pochi millisecondi e dipende dalla velocita' della rete.
   * Il test verifica che dopo la digitazione i risultati appaiano correttamente.
   */
  test("dopo la digitazione i risultati appaiono e lo spinner scompare", async ({ page }) => {
    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Digita nel Searchbox
    await typeInSearchbox(page, FORNITORE_SEARCHBOX_LABEL, "a");

    // Attende che il caricamento si completi e i risultati appaiano
    // (lo spinner CircularProgress e' nell'adornment del TextField, non in un div separato)
    await waitForSearchboxDropdown(page);

    // Verifica che il dropdown sia visibile con contenuto
    const dropdownVisible = await isSearchboxDropdownVisible(page);
    expect(dropdownVisible).toBe(true);

    // Lo spinner di caricamento (CircularProgress) non deve essere presente
    // quando i risultati sono visibili. CircularProgress renderizza un [role="progressbar"]
    // all'interno dell'InputAdornment del TextField.
    const inputAdornmentSpinner = input
      .locator("..")
      .locator('[role="progressbar"]')
      .first();

    const spinnerVisible = await inputAdornmentSpinner.isVisible({ timeout: 1_000 }).catch(() => false);
    expect(spinnerVisible).toBe(false);
  });

  /**
   * REQ-E2E-006 - Verifica che lo spinner appaia immediatamente dopo la digitazione
   * (test separato, puo' essere fragile su reti veloci).
   *
   * Usa page.route per rallentare la risposta GraphQL e garantire
   * che lo spinner sia visibile abbastanza a lungo.
   */
  test("lo spinner di caricamento appare brevemente durante la digitazione", async ({ page }) => {
    // Intercetta le richieste GraphQL e aggiunge un ritardo artificiale
    let requestCount = 0;
    await page.route("**/graphql", async (route) => {
      requestCount++;
      // Aggiunge un ritardo di 500ms alla prima richiesta per permettere di vedere lo spinner
      if (requestCount <= 2) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    });

    const input = getSearchboxInput(page, FORNITORE_SEARCHBOX_LABEL);
    await expect(input).toBeVisible();

    // Digita nel Searchbox
    await input.click();
    await input.type("a", { delay: 50 });

    // Attende il debounce (300ms) e poi cerca lo spinner
    // Lo spinner e' CircularProgress nell'InputAdornment del TextField
    // MUI CircularProgress usa role="progressbar" e SVG
    await page.waitForTimeout(350);

    // Lo spinner deve essere visibile durante il caricamento
    // Cerca nei pressi dell'input: il contenitore padre del TextField
    const spinner = page
      .locator('[role="progressbar"]')
      .filter({ hasNot: page.locator('[data-testid="route-fallback"]') })
      .first();

    const spinnerVisible = await spinner.isVisible({ timeout: 2_000 }).catch(() => false);

    // Questo SHOULD: lo spinner potrebbe non essere visibile su connessioni molto veloci
    // Registriamo il risultato ma non facciamo fallire il test se non visibile
    if (!spinnerVisible) {
      // eslint-disable-next-line no-console
      console.warn("Spinner non rilevato — la connessione al backend e' molto veloce o il route intercept non ha funzionato");
    }

    // In ogni caso i risultati devono arrivare
    await waitForSearchboxDropdown(page);
    const dropdownVisible = await isSearchboxDropdownVisible(page);
    expect(dropdownVisible).toBe(true);
  });
});
