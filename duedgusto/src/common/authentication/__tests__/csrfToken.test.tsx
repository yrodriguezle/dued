import { describe, it, expect } from "vitest";
import { getCsrfTokenFromCookie, getCsrfToken, hasCsrfToken } from "../csrfToken";

/**
 * Test per csrfToken.tsx
 *
 * NOTA: Le funzioni CSRF sono deprecate e non piu' utilizzate nell'applicazione.
 * Questi test verificano il comportamento attuale delle funzioni deprecate:
 * - getCsrfTokenFromCookie restituisce sempre null
 * - getCsrfToken lancia sempre un errore
 * - hasCsrfToken restituisce sempre false
 */
describe("csrfToken (deprecated)", () => {
  // ─── getCsrfTokenFromCookie ─────────────────────────────────────

  describe("getCsrfTokenFromCookie", () => {
    it("dovrebbe restituire sempre null (funzione deprecata)", () => {
      const result = getCsrfTokenFromCookie();
      expect(result).toBeNull();
    });

    it("dovrebbe restituire null anche se un cookie XSRF-TOKEN esiste nel documento", () => {
      // Anche con un cookie impostato, la funzione deprecata restituisce sempre null
      const originalCookie = document.cookie;
      Object.defineProperty(document, "cookie", {
        value: "XSRF-TOKEN=abc123; other=value",
        writable: true,
        configurable: true,
      });

      const result = getCsrfTokenFromCookie();
      expect(result).toBeNull();

      // Ripristina
      Object.defineProperty(document, "cookie", {
        value: originalCookie,
        writable: true,
        configurable: true,
      });
    });
  });

  // ─── getCsrfToken ──────────────────────────────────────────────

  describe("getCsrfToken", () => {
    it("dovrebbe lanciare un errore (funzione deprecata)", () => {
      expect(() => getCsrfToken()).toThrow("CSRF protection has been removed from this application");
    });
  });

  // ─── hasCsrfToken ──────────────────────────────────────────────

  describe("hasCsrfToken", () => {
    it("dovrebbe restituire sempre false (funzione deprecata)", () => {
      const result = hasCsrfToken();
      expect(result).toBe(false);
    });
  });
});
