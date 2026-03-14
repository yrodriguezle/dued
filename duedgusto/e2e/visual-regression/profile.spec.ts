import { test, expect } from "@playwright/test";
import { visualTest, navigateAndWait, waitForPageReady, AUTH_STATE_PATH } from "./helpers";

/**
 * Test E2E per la pagina Profilo.
 *
 * Copertura:
 * - Visual regression della pagina completa
 * - Navigazione dal menu utente
 * - Form editing e bottone Salva
 * - Blocco navigazione con modifiche non salvate
 */

test.use({ storageState: AUTH_STATE_PATH });

test.describe("Pagina Profilo", () => {
  test("profilo — visual regression pagina completa", async ({ page }) => {
    await visualTest(page, "profilo", "profile-full");
  });

  test("profilo — navigazione dal menu utente nell'header", async ({ page }) => {
    // Vai alla dashboard prima
    await navigateAndWait(page, "dashboard");

    // Click sull'avatar/icona utente nell'header
    const avatarButton = page.getByRole("button", { name: /impostazioni/i });
    await avatarButton.click();

    // Click su "Profilo" nel menu dropdown
    const profiloMenuItem = page.getByRole("menuitem", { name: /profilo/i });
    await profiloMenuItem.click();

    // Verifica che siamo sulla pagina profilo
    await waitForPageReady(page);
    await expect(page.getByText("Dati Personali")).toBeVisible();
    await expect(page.getByText("Cambio Password")).toBeVisible();
  });

  test("profilo — modifica campo abilita bottone Salva", async ({ page }) => {
    await navigateAndWait(page, "profilo");

    // Il bottone Salva deve essere inizialmente disabilitato
    const salvaButton = page.getByRole("button", { name: /salva/i });
    await expect(salvaButton).toBeDisabled();

    // Modifica il campo Descrizione
    const descrizioneInput = page.getByLabel("Descrizione");
    await descrizioneInput.fill("Test modifica E2E");

    // Il bottone Salva deve essere ora abilitato
    await expect(salvaButton).toBeEnabled();
  });

  test("profilo — dialog conferma quando si naviga con modifiche non salvate", async ({ page }) => {
    await navigateAndWait(page, "profilo");

    // Modifica un campo
    const descrizioneInput = page.getByLabel("Descrizione");
    await descrizioneInput.fill("Modifica non salvata");

    // Tenta di navigare via cliccando un link nella sidebar
    const sidebarLink = page.locator("nav").getByRole("button").first();
    if (await sidebarLink.isVisible()) {
      await sidebarLink.click();
    } else {
      // Se la sidebar non è visibile, naviga manualmente
      await page.goto("/gestionale/dashboard");
    }

    // Verifica che appare il dialog di conferma
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/modifiche non salvate/i)).toBeVisible();

    // Click "Resta" per annullare la navigazione
    const restaButton = page.getByRole("button", { name: /resta/i });
    await restaButton.click();

    // Verifica che siamo ancora sulla pagina profilo
    await expect(page.getByText("Dati Personali")).toBeVisible();
  });
});
