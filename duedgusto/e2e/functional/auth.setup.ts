import { test as setup } from "@playwright/test";
import { AUTH_STATE_PATH } from "./helpers";
import fs from "fs";
import path from "path";

/**
 * Authentication setup per i test funzionali E2E.
 *
 * Questo script effettua il login tramite la pagina di signin e salva lo stato
 * di autenticazione (cookies + localStorage) in un file riutilizzabile dai test.
 *
 * Usa le stesse credenziali del setup visual-regression.
 * Lo stato viene salvato nello stesso file .auth/storageState.json condiviso.
 *
 * Prerequisiti:
 *   - Backend running su https://0.0.0.0:4000
 *   - Frontend running su http://localhost:4001
 *
 * Esegui con:
 *   npx playwright test e2e/functional/auth.setup.ts --project=functional-setup
 */

const USERNAME = process.env.TEST_USERNAME || "superadmin";
const PASSWORD = process.env.TEST_PASSWORD || "Du3*gust0-2025";

setup("authenticate per test funzionali", async ({ page }) => {
  // Garantisce che la directory .auth esista
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Naviga alla pagina di login
  await page.goto("/signin");

  // Compila le credenziali
  await page.getByLabel("Nome utente").fill(USERNAME);
  await page.getByLabel("Password").fill(PASSWORD);

  // Invia il form
  await page.getByRole("button", { name: "Accedi" }).click();

  // Attende il redirect all'area protetta
  await page.waitForURL("**/gestionale/**", { timeout: 15_000 });

  // Salva lo stato autenticato
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
