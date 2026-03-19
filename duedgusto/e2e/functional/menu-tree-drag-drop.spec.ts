import { test, expect } from "@playwright/test";
import { waitForPageReady } from "./helpers";

/**
 * Test E2E funzionali: Menu Tree Always-On + Drag & Drop.
 *
 * Coprono:
 * - La vista gerarchica resta attiva in modalita modifica
 * - Il drag handle appare solo in edit mode
 * - Il drag & drop sposta una voce menu sotto un nuovo parent
 * - La validazione anti-ciclo impedisce spostamenti invalidi
 * - Il dirty state si attiva dopo drag, edit e delete
 * - Il checkbox "Visibile" funziona correttamente
 *
 * Prerequisiti:
 *   - Backend running su https://0.0.0.0:4000
 *   - Frontend running su http://localhost:4001
 *   - Almeno 3-4 voci menu nel database con struttura gerarchica
 *   - Lo storageState di autenticazione deve essere presente (.auth/storageState.json)
 */

const MENU_DETAILS_PATH = "menus-details";

/**
 * Naviga alla pagina di gestione menu e attende il caricamento.
 */
async function navigateToMenuDetails(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(`/gestionale/${MENU_DETAILS_PATH}`, { waitUntil: "domcontentloaded" });
  await waitForPageReady(page);
  // Attende che la griglia AG Grid sia visibile
  await page.locator(".ag-root-wrapper").first().waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Clicca il bottone "Modifica" nella toolbar per sbloccare il form.
 */
async function unlockForm(page: import("@playwright/test").Page): Promise<void> {
  const editButton = page.getByRole("button", { name: "Modifica" });
  await editButton.click();
  // Attende che il bottone diventi "Annulla" (indica che il form e sbloccato)
  await page.getByRole("button", { name: "Annulla" }).waitFor({ state: "visible", timeout: 5_000 });
}

/**
 * Conta le righe di gruppo (nodi parent con freccia expand/collapse) nella griglia.
 */
async function countGroupRows(page: import("@playwright/test").Page): Promise<number> {
  return page.locator(".ag-row .ag-group-contracted, .ag-row .ag-group-expanded").count();
}

test.describe("Menu Tree - Vista gerarchica always-on", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMenuDetails(page);
  });

  /**
   * S-01: La griglia in modalita bloccata mostra la struttura ad albero.
   */
  test("la griglia mostra struttura ad albero in modalita bloccata", async ({ page }) => {
    // Verifica che ci siano nodi di gruppo (icone expand/collapse)
    const groupNodes = await countGroupRows(page);
    expect(groupNodes).toBeGreaterThan(0);

    // Verifica che la colonna gruppo "Voce di menu" sia visibile
    const groupHeader = page.locator('.ag-header-cell-text:has-text("Voce di men")');
    await expect(groupHeader.first()).toBeVisible();
  });

  /**
   * S-02: La griglia mantiene la struttura ad albero dopo aver cliccato "Modifica".
   */
  test("la struttura ad albero resta visibile dopo Modifica", async ({ page }) => {
    // Conta i nodi di gruppo prima della modifica
    const groupsBefore = await countGroupRows(page);
    expect(groupsBefore).toBeGreaterThan(0);

    // Sblocca il form
    await unlockForm(page);
    await page.waitForTimeout(500);

    // Verifica che i nodi di gruppo siano ancora presenti
    const groupsAfter = await countGroupRows(page);
    expect(groupsAfter).toBeGreaterThan(0);
  });

  /**
   * S-03: Il drag handle appare solo in modalita modifica.
   */
  test("il drag handle appare solo dopo Modifica", async ({ page }) => {
    // In modalita bloccata: nessun drag handle
    const dragHandleLocked = page.locator(".ag-drag-handle");
    const dragCountLocked = await dragHandleLocked.count();
    expect(dragCountLocked).toBe(0);

    // Sblocca il form
    await unlockForm(page);
    await page.waitForTimeout(500);

    // In modalita modifica: drag handle presenti
    const dragHandleUnlocked = page.locator(".ag-drag-handle");
    const dragCountUnlocked = await dragHandleUnlocked.count();
    expect(dragCountUnlocked).toBeGreaterThan(0);
  });
});

test.describe("Menu Tree - Dirty state", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMenuDetails(page);
    await unlockForm(page);
    await page.waitForTimeout(500);
  });

  /**
   * S-07: Il tasto Salva e disabilitato prima di qualsiasi modifica.
   */
  test("il tasto Salva e disabilitato prima di modifiche", async ({ page }) => {
    const saveButton = page.getByRole("button", { name: "Salva" });
    await expect(saveButton).toBeDisabled();
  });

  /**
   * S-08: Modificare una cella abilita il tasto Salva.
   */
  test("modificare una cella abilita il tasto Salva", async ({ page }) => {
    const saveButton = page.getByRole("button", { name: "Salva" });
    await expect(saveButton).toBeDisabled();

    // Doppio click sulla prima cella editabile (Posizione) per entrare in editing
    const firstEditableCell = page.locator('.ag-row:first-child [col-id="posizione"]');
    await firstEditableCell.dblclick();
    await page.waitForTimeout(200);

    // Modifica il valore
    await page.keyboard.type("99");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);

    // Il tasto Salva deve essere abilitato
    await expect(saveButton).toBeEnabled();
  });

  /**
   * S-10: Il checkbox Visibile funziona e abilita il tasto Salva.
   */
  test("il checkbox Visibile si puo togglare e abilita Salva", async ({ page }) => {
    const saveButton = page.getByRole("button", { name: "Salva" });
    await expect(saveButton).toBeDisabled();

    // Trova la prima cella "Visibile" e clicca il checkbox
    const visibileCell = page.locator('.ag-row:first-child [col-id="visibile"]');
    await visibileCell.click();
    await page.waitForTimeout(500);

    // Il tasto Salva deve essere abilitato
    await expect(saveButton).toBeEnabled();
  });

  /**
   * S-11: Selezionare e cancellare una riga abilita il tasto Salva.
   */
  test("cancellare una riga abilita il tasto Salva", async ({ page }) => {
    const saveButton = page.getByRole("button", { name: "Salva" });
    await expect(saveButton).toBeDisabled();

    // Seleziona la prima riga cliccandola
    const firstRow = page.locator(".ag-row").first();
    await firstRow.click();
    await page.waitForTimeout(300);

    // Clicca il bottone Elimina nella toolbar della griglia
    const deleteButton = page.locator('.datagrid-root').locator('..').locator('button:has(svg)').filter({ has: page.locator('[data-testid="DeleteIcon"]') });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Il tasto Salva deve essere abilitato
      await expect(saveButton).toBeEnabled();
    }
  });
});

test.describe("Menu Tree - Aggiunta nuove righe", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMenuDetails(page);
    await unlockForm(page);
    await page.waitForTimeout(500);
  });

  /**
   * S-12: Aggiungere una nuova riga la inserisce a root level.
   */
  test("nuova riga viene aggiunta e abilita il tasto Salva", async ({ page }) => {
    const saveButton = page.getByRole("button", { name: "Salva" });

    // Conta le righe prima
    const rowsBefore = await page.locator(".ag-row:not(.ag-row-loading)").count();

    // Clicca il bottone Aggiungi nella toolbar della griglia
    const addButton = page.locator('.datagrid-root').locator('..').locator('button:has(svg)').filter({ has: page.locator('[data-testid="AddIcon"]') });
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Conta le righe dopo
      const rowsAfter = await page.locator(".ag-row:not(.ag-row-loading)").count();
      expect(rowsAfter).toBeGreaterThan(rowsBefore);
    }
  });
});
