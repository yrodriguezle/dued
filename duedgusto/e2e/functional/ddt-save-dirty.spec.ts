import { test, expect } from "@playwright/test";
import { AUTH_STATE_PATH, navigateAndWait, waitForPageReady } from "./helpers";

test.use({ storageState: AUTH_STATE_PATH });

/**
 * Compila i campi obbligatori del DDT e seleziona un fornitore.
 */
async function fillDdtForm(page: import("@playwright/test").Page, ddtNumber: string) {
  const fornitoreInput = page.getByLabel("Fornitore *");
  await fornitoreInput.click();
  await fornitoreInput.fill("Rossi");
  await page.locator(".ag-row:not(.ag-row-loading)").first().waitFor({ state: "visible", timeout: 5_000 });
  await page.locator(".ag-row:not(.ag-row-loading)").first().dblclick();

  await page.getByLabel("Numero DDT *").fill(ddtNumber);
  await page.getByLabel("Data DDT *").fill("2025-01-15");
}

test.describe("DDT Save - dirty state bug", () => {
  test("INSERT: dopo il salvataggio la navigazione automatica non deve essere bloccata", async ({ page }) => {
    await navigateAndWait(page, "documenti-trasporto-details");
    await fillDdtForm(page, `TEST-DIRTY-${Date.now()}`);

    await page.getByRole("button", { name: "Salva" }).click();

    await expect(page.getByText("DDT salvato con successo")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/ddtId=\d+/, { timeout: 5_000 });
    await expect(page.getByText("Hai delle modifiche non salvate")).not.toBeVisible();
  });

  test("UPDATE: dopo il salvataggio il form non deve risultare dirty", async ({ page }) => {
    // Crea il DDT e attendi navigazione
    await navigateAndWait(page, "documenti-trasporto-details");
    await fillDdtForm(page, `TEST-DIRTY-UPD-${Date.now()}`);
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText("DDT salvato con successo")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/ddtId=\d+/, { timeout: 5_000 });

    // Estrai ddtId dall'URL e ri-naviga direttamente per garantire il load
    const url = page.url();
    const ddtId = url.match(/ddtId=(\d+)/)?.[1];

    await navigateAndWait(page, `documenti-trasporto-details?ddtId=${ddtId}`);

    // Attendi che il form sia in UPDATE mode (Modifica abilitato)
    await expect(page.getByRole("button", { name: "Modifica" })).toBeEnabled({ timeout: 15_000 });

    // Sblocca il form
    await page.getByRole("button", { name: "Modifica" }).click();

    // Modifica un campo
    await page.getByLabel("Note").fill("Nota aggiornata da test E2E");

    // Salva le modifiche (UPDATE mode)
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText("DDT salvato con successo")).toBeVisible({ timeout: 10_000 });
    await waitForPageReady(page);

    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(500);

    // Naviga a un'altra pagina via sidebar — se dirty, il blocker scatta
    await page.getByRole("button", { name: "Dashboard" }).click();

    // Il dialog "Modifiche non salvate" NON deve apparire
    await expect(page.getByText("Hai delle modifiche non salvate")).not.toBeVisible({ timeout: 3_000 });
  });
});
