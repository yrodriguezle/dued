import { test, expect } from "@playwright/test";
import { AUTH_STATE_PATH, navigateAndWait, waitForPageReady } from "./helpers";

test.use({ storageState: AUTH_STATE_PATH });

/**
 * Bug fix: i pagamenti creati dal form DDT non venivano sincronizzati
 * con il RegistroCassa. Il campo RegistroCassaId restava null,
 * e la gestione cassa non li mostrava.
 *
 * Questo test verifica che un pagamento inserito contestualmente
 * al salvataggio di un DDT appaia poi nella gestione cassa
 * alla data corrispondente.
 */
test.describe("DDT → Gestione Cassa: sync pagamenti", () => {
  test("il pagamento di un DDT appare nella gestione cassa alla data del pagamento", async ({ page }) => {
    const uniqueId = Date.now();
    const ddtNumber = `E2E-SYNC-${uniqueId}`;
    // Usa la data di oggi per il pagamento (formato YYYY-MM-DD)
    const today = new Date();
    const paymentDate = today.toISOString().split("T")[0];

    // ── 1. Crea un DDT con un pagamento ──

    await navigateAndWait(page, "documenti-trasporto-details");

    // Seleziona il fornitore
    const fornitoreInput = page.getByLabel("Fornitore *");
    await fornitoreInput.click();
    await fornitoreInput.fill("Rossi");
    await page.locator(".ag-row:not(.ag-row-loading)").first().waitFor({ state: "visible", timeout: 5_000 });
    await page.locator(".ag-row:not(.ag-row-loading)").first().dblclick();

    // Compila i campi del DDT
    await page.getByLabel("Numero DDT *").fill(ddtNumber);
    await page.getByLabel("Data DDT *").fill(paymentDate);
    await page.getByLabel("Importo").click();
    await page.getByLabel("Importo").fill("42.50");

    // Aggiungi un pagamento nella griglia dei pagamenti.
    // NUOVA RIGA crea una riga con defaults: data=oggi, importo=0.
    await page.getByRole("button", { name: /nuova riga/i }).click();

    // Attendi che la riga appaia nella griglia
    const paymentRow = page.locator(".ag-center-cols-container .ag-row").first();
    await paymentRow.waitFor({ state: "visible", timeout: 3_000 });

    // Edita la cella Importo (col-id="amount"):
    // dblclick apre il cell editor, Enter conferma l'edit
    const amountCell = paymentRow.locator('[col-id="amount"]');
    await amountCell.dblclick();
    // Seleziona tutto e sovrascrivi con il nuovo valore
    await page.keyboard.press("Control+a");
    await page.keyboard.type("42.50");
    await page.keyboard.press("Enter");

    // Clicca sul titolo per deselezionare la riga nella griglia
    await page.getByText("Dettaglio DDT").click();

    // Salva il DDT
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText("DDT salvato con successo")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/ddtId=\d+/, { timeout: 5_000 });

    // ── 2. Naviga alla gestione cassa per la data del pagamento ──

    await navigateAndWait(page, `cassa/details/${paymentDate}`);
    await waitForPageReady(page);

    // ── 3. Verifica che il pagamento DDT appaia ──

    // Il pagamento dovrebbe apparire come spesa fornitore con formato:
    // "Pagamento <NomeFornitore> - DDT <NumeroDDT>"
    await expect(page.getByText(ddtNumber, { exact: false })).toBeVisible({ timeout: 10_000 });
  });
});
