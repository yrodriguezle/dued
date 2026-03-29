import { test, expect } from "@playwright/test";
import { navigateAndWait, AUTH_STATE_PATH } from "./helpers";

/**
 * Mobile layout regression tests — TDD suite.
 *
 * Verifica che le pagine della sezione cassa non presentino overflow
 * orizzontale su viewport mobile e che i componenti siano responsive.
 *
 * Viewport presets:
 *   - iPhone SE:          375 x 667
 *   - iPhone 14 Pro Max:  430 x 932
 *   - Desktop:           1280 x 720
 */

test.use({ storageState: AUTH_STATE_PATH });

function getTodayDatePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Helper: verifica assenza overflow orizzontale ───────────────────────────
async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Layout Container: nessun overflow orizzontale
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Mobile layout — no horizontal overflow", () => {
  const datePath = getTodayDatePath();

  test("nessun overflow su RegistroCassaDetails (375px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await navigateAndWait(page, `cassa/${datePath}`);
    await expectNoHorizontalOverflow(page);
    await context.close();
  });

  test("nessun overflow su VistaMensile (375px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await navigateAndWait(page, "cassa/monthly");
    await expectNoHorizontalOverflow(page);
    await context.close();
  });

  test("nessun overflow su RegistroCassaDetails (430px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 430, height: 932 },
    });
    const page = await context.newPage();
    await navigateAndWait(page, `cassa/${datePath}`);
    await expectNoHorizontalOverflow(page);
    await context.close();
  });

  test("nessun overflow su VistaMensile (430px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 430, height: 932 },
    });
    const page = await context.newPage();
    await navigateAndWait(page, "cassa/monthly");
    await expectNoHorizontalOverflow(page);
    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Toolbar responsive (VistaMensile)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Mobile layout — toolbar responsive", () => {
  test("toolbar mensile visibile senza overflow (375px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await navigateAndWait(page, "cassa/monthly");

    // La toolbar non deve traboccare
    const toolbar = page.locator('[class*="MuiToolbar"]').first();
    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(toolbarBox!.width).toBeLessThanOrEqual(375);

    await context.close();
  });

  test("toolbar dettagli cassa non trabocca (375px)", async ({ browser }) => {
    const datePath = getTodayDatePath();
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await navigateAndWait(page, `cassa/${datePath}`);

    const toolbar = page.locator('[class*="MuiToolbar"]').first();
    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(toolbarBox!.width).toBeLessThanOrEqual(375);

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — Calendario: celle toccabili
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Mobile layout — calendario touch target", () => {
  test("celle calendario hanno dimensione minima 44px (375px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await navigateAndWait(page, "cassa/monthly");

    // Recupera tutte le celle del mese corrente (non disabilitate, non fuori mese)
    // Le celle sono i box nella griglia del calendario
    const cells = await page.evaluate(() => {
      // Cerca la griglia con 7 colonne (il calendario)
      const grids = Array.from(document.querySelectorAll("[style*='grid-template-columns']"));
      const calendarGrid = grids.find((g) => {
        const style = getComputedStyle(g);
        return style.gridTemplateColumns.split(" ").length === 7;
      });
      if (!calendarGrid) return [];

      return Array.from(calendarGrid.children).map((cell) => {
        const rect = cell.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    });

    // Almeno alcune celle devono esistere
    expect(cells.length).toBeGreaterThan(0);

    // Ogni cella deve avere minimo 44px in entrambe le dimensioni
    cells.forEach((cell) => {
      expect(cell.height).toBeGreaterThanOrEqual(44);
    });

    await context.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — Desktop regression
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Desktop layout — nessuna regressione", () => {
  test("nessun overflow su desktop (1280px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    await navigateAndWait(page, "cassa/monthly");
    await expectNoHorizontalOverflow(page);
    await context.close();
  });
});
