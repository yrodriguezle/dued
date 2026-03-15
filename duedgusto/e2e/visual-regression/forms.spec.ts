import { test } from "@playwright/test";
import { visualTest, navigateAndWait, takeScreenshot, AUTH_STATE_PATH } from "./helpers";

/**
 * Visual regression tests for Form pages.
 *
 * Covers:
 * - UserForm (via UserDetails at /gestionale/users/new or users list)
 * - RoleForm (via RoleDetails at /gestionale/roles/new or roles list)
 * - FornitoreForm (via FornitoreDetails at /gestionale/fornitori/new)
 * - DeliveryNoteForm (via DeliveryNoteDetails at /gestionale/delivery-notes/new)
 * - PurchaseInvoiceForm (via PurchaseInvoiceDetails at /gestionale/purchases/new)
 *
 * NOTE: The actual route paths depend on the database menu configuration.
 * The paths below are best guesses based on the codebase. Adjust them
 * after verifying against the running application.
 */

test.use({ storageState: AUTH_STATE_PATH });

// --- User pages ---
test.describe("User Pages", () => {
  test("user list page", async ({ page }) => {
    await visualTest(page, "users-list", "user-list");
  });

  test("user form — new user", async ({ page }) => {
    // Navigate to user list first, then click new if available
    await navigateAndWait(page, "users/new");
    await takeScreenshot(page, "user-form-new");
  });
});

// --- Role pages ---
test.describe("Role Pages", () => {
  test("role list page", async ({ page }) => {
    await visualTest(page, "roles-list", "role-list");
  });

  test("role form — new role", async ({ page }) => {
    await navigateAndWait(page, "roles/new");
    await takeScreenshot(page, "role-form-new");
  });
});

// --- Fornitore pages ---
test.describe("Fornitore Pages", () => {
  test("fornitore list page", async ({ page }) => {
    await visualTest(page, "fornitori-list", "fornitore-list");
  });

  test("fornitore form — new fornitore", async ({ page }) => {
    await navigateAndWait(page, "fornitori/new");
    await takeScreenshot(page, "fornitore-form-new");
  });
});

// --- Delivery Note pages ---
test.describe("Delivery Note Pages", () => {
  test("delivery note list page", async ({ page }) => {
    await visualTest(page, "delivery-notes-list", "delivery-note-list");
  });

  test("delivery note form — new", async ({ page }) => {
    await navigateAndWait(page, "delivery-notes/new");
    await takeScreenshot(page, "delivery-note-form-new");
  });
});

// --- Purchase Invoice pages ---
test.describe("Purchase Invoice Pages", () => {
  test("purchase invoice list page", async ({ page }) => {
    await visualTest(page, "purchases-list", "purchase-invoice-list");
  });

  test("purchase invoice form — new", async ({ page }) => {
    await navigateAndWait(page, "purchases/new");
    await takeScreenshot(page, "purchase-invoice-form-new");
  });
});
