import { test, expect } from "@playwright/test";
import { visualTest, navigateAndWait, takeScreenshot, AUTH_STATE_PATH } from "./helpers";

/**
 * Visual regression tests for Registro Cassa (Cash Register) pages.
 *
 * Covers all 8 registro cassa files:
 * 1. RegistroCassaDetails — main daily cash register view (/gestionale/cassa/:date)
 * 2. CashRegisterFormDataGrid — inline data grid within the register
 * 3. CashCountDataGrid — cash count section
 * 4. IncomesDataGrid — incomes section
 * 5. ExpensesDataGrid — expenses section
 * 6. SummaryDataGrid — summary section
 * 7. RegistroCassaVistaMensile — monthly overview (/gestionale/cassa/monthly)
 * 8. MonthlyClosureDetails — monthly closure form (/gestionale/cassa/monthly-closure/new)
 *
 * NOTE: Components 2-6 are sub-components rendered within RegistroCassaDetails.
 * We test them by scrolling to their sections within the page.
 */

test.use({ storageState: AUTH_STATE_PATH });

/**
 * Helper to get today's date in YYYY-MM-DD format for the cassa route.
 */
function getTodayDatePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- Main Registro Cassa Details page ---
test.describe("Registro Cassa Details", () => {
  const datePath = getTodayDatePath();

  test("registro cassa — full page view", async ({ page }) => {
    await visualTest(page, `cassa/${datePath}`, "registro-cassa-full");
  });

  test("registro cassa — cash register form data grid", async ({ page }) => {
    await navigateAndWait(page, `cassa/${datePath}`);

    // The CashRegisterFormDataGrid is typically the first data grid section
    const formGrid = page.locator(".ag-root-wrapper").first();
    if (await formGrid.isVisible()) {
      await formGrid.scrollIntoViewIfNeeded();
    }

    await takeScreenshot(page, "registro-cassa-form-grid");
  });

  test("registro cassa — cash count data grid", async ({ page }) => {
    await navigateAndWait(page, `cassa/${datePath}`);

    // Look for the cash count section by heading or label
    const cashCountSection = page.getByText(/conteggio cassa|conta cassa|cash count/i).first();
    if (await cashCountSection.isVisible()) {
      await cashCountSection.scrollIntoViewIfNeeded();
    }

    await takeScreenshot(page, "registro-cassa-cash-count");
  });

  test("registro cassa — incomes data grid", async ({ page }) => {
    await navigateAndWait(page, `cassa/${datePath}`);

    // Look for the incomes section
    const incomesSection = page.getByText(/entrate|incassi|ricavi/i).first();
    if (await incomesSection.isVisible()) {
      await incomesSection.scrollIntoViewIfNeeded();
    }

    await takeScreenshot(page, "registro-cassa-incomes");
  });

  test("registro cassa — expenses data grid", async ({ page }) => {
    await navigateAndWait(page, `cassa/${datePath}`);

    // Look for the expenses section
    const expensesSection = page.getByText(/uscite|spese|expenses/i).first();
    if (await expensesSection.isVisible()) {
      await expensesSection.scrollIntoViewIfNeeded();
    }

    await takeScreenshot(page, "registro-cassa-expenses");
  });

  test("registro cassa — summary data grid", async ({ page }) => {
    await navigateAndWait(page, `cassa/${datePath}`);

    // Look for the summary section
    const summarySection = page.getByText(/riepilogo|sommario|summary/i).first();
    if (await summarySection.isVisible()) {
      await summarySection.scrollIntoViewIfNeeded();
    }

    await takeScreenshot(page, "registro-cassa-summary");
  });

  test("registro cassa — nessuno scroll globale a livello viewport", async ({ page }) => {
    await navigateAndWait(page, `cassa/${datePath}`);

    // Verifica che html e body abbiano overflow: hidden (previene scroll globale)
    const overflowCheck = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        htmlOverflow: getComputedStyle(html).overflow,
        bodyOverflow: getComputedStyle(body).overflow,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        bodyFits: body.scrollHeight <= body.clientHeight,
      };
    });

    // html e body devono avere overflow: hidden per prevenire scroll globale
    expect(overflowCheck.htmlOverflow).toBe("hidden");
    expect(overflowCheck.bodyOverflow).toBe("hidden");
    // body non deve traboccare
    expect(overflowCheck.bodyFits).toBe(true);
  });

  test("registro cassa — SummaryDataGrid altezza contenuta", async ({ page }) => {
    await navigateAndWait(page, `cassa/${datePath}`);

    // Scrolla il container interno per rendere visibile il SummaryDataGrid (su mobile è sotto il fold)
    const summaryHeading = page.getByText("RIEPILOGO VENDITE");
    await summaryHeading.scrollIntoViewIfNeeded();
    await expect(summaryHeading).toBeVisible();

    // Il parent Box di SummaryDataGrid dovrebbe avere altezza ragionevole (< 500px con margini)
    const summaryBox = summaryHeading.locator("..");
    const boundingBox = await summaryBox.boundingBox();
    expect(boundingBox).not.toBeNull();

    // Con domLayout="autoHeight" l'altezza esplode; con altezza fissa deve restare sotto 500px
    expect(boundingBox!.height).toBeLessThan(500);
  });
});

// --- Monthly Cash Register Page ---
test.describe("Registro Cassa Monthly", () => {
  test("monthly overview page", async ({ page }) => {
    await visualTest(page, "cassa/monthly", "registro-cassa-monthly");
  });
});

// --- Monthly Closure Details ---
test.describe("Monthly Closure", () => {
  test("monthly closure — new", async ({ page }) => {
    await visualTest(page, "cassa/monthly-closure/new", "monthly-closure-new");
  });
});
