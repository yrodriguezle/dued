import { describe, it, expect, beforeEach } from "vitest";
import {
  getAuthToken,
  setAuthToken,
  isAuthenticated,
  getAuthHeaders,
  decodeJwtPayload,
  removeAuthToken,
  setRememberPassword,
  hasRememberPassword,
  removeRememberPassword,
} from "../auth";

/**
 * Helper per creare un JWT valido di test.
 * Il token ha 3 parti separate da ".": header.payload.signature
 */
const createTestJwt = (payload: Record<string, unknown>): string => {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const signature = btoa("fake-signature");
  return `${header}.${body}.${signature}`;
};

/**
 * Helper per creare un AuthToken di test con un JWT valido e non scaduto.
 */
const createValidAuthToken = (expInSeconds?: number): AuthToken => {
  const exp = expInSeconds ?? Math.floor(Date.now() / 1000) + 3600; // +1 ora
  const token = createTestJwt({ sub: "user1", exp });
  return { token, refreshToken: "refresh-token-123" };
};

describe("auth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── getAuthToken ───────────────────────────────────────────────

  describe("getAuthToken", () => {
    it("dovrebbe restituire il token quando jwtToken esiste in localStorage", () => {
      const authToken: AuthToken = { token: "abc123", refreshToken: "ref456" };
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      const result = getAuthToken();
      expect(result).toEqual(authToken);
    });

    it("dovrebbe restituire null quando non esiste jwtToken in localStorage", () => {
      const result = getAuthToken();
      expect(result).toBeNull();
    });

    it("dovrebbe restituire null quando jwtToken e' una stringa vuota", () => {
      // localStorage.getItem restituisce "" che e' falsy, quindi il cortocircuito || restituisce null
      localStorage.setItem("jwtToken", "");
      const result = getAuthToken();
      // Il codice fa: localStorage.getItem("jwtToken") && JSON.parse(...)
      // "" && ... => "" che e' falsy, quindi || null => null
      expect(result).toBeNull();
    });
  });

  // ─── setAuthToken ───────────────────────────────────────────────

  describe("setAuthToken", () => {
    it("dovrebbe salvare il token in localStorage", () => {
      const authToken: AuthToken = { token: "abc123", refreshToken: "ref456" };
      setAuthToken(authToken);

      const stored = JSON.parse(localStorage.getItem("jwtToken") || "null");
      expect(stored).toEqual(authToken);
    });

    it("dovrebbe fare il merge con i dati esistenti del token", () => {
      // Salva un primo token
      const initialToken: AuthToken = { token: "old-token", refreshToken: "old-refresh" };
      localStorage.setItem("jwtToken", JSON.stringify(initialToken));

      // Aggiorna solo il token (il refreshToken dovrebbe rimanere se non sovrascritto)
      const updateToken: AuthToken = { token: "new-token", refreshToken: "new-refresh" };
      setAuthToken(updateToken);

      const stored = JSON.parse(localStorage.getItem("jwtToken") || "null");
      expect(stored.token).toBe("new-token");
      expect(stored.refreshToken).toBe("new-refresh");
    });

    it("dovrebbe creare un nuovo token quando non esiste un token precedente", () => {
      // Nessun token in localStorage
      const authToken: AuthToken = { token: "abc123", refreshToken: "ref456" };
      setAuthToken(authToken);

      const stored = JSON.parse(localStorage.getItem("jwtToken") || "null");
      expect(stored).toEqual(authToken);
    });
  });

  // ─── removeAuthToken ───────────────────────────────────────────

  describe("removeAuthToken", () => {
    it("dovrebbe rimuovere il token da localStorage", () => {
      localStorage.setItem("jwtToken", JSON.stringify({ token: "abc", refreshToken: "ref" }));
      removeAuthToken();
      expect(localStorage.getItem("jwtToken")).toBeNull();
    });
  });

  // ─── decodeJwtPayload ──────────────────────────────────────────

  describe("decodeJwtPayload", () => {
    it("dovrebbe decodificare correttamente un payload JWT base64url", () => {
      const payload = { sub: "user1", name: "Test User", exp: 1234567890 };
      const token = createTestJwt(payload);

      const decoded = decodeJwtPayload(token);
      expect(decoded).toEqual(payload);
    });

    it("dovrebbe restituire null per un token con meno di 3 parti", () => {
      expect(decodeJwtPayload("only-one-part")).toBeNull();
      expect(decodeJwtPayload("two.parts")).toBeNull();
    });

    it("dovrebbe restituire null per un token con piu' di 3 parti", () => {
      expect(decodeJwtPayload("a.b.c.d")).toBeNull();
    });

    it("dovrebbe restituire null per un token con payload non base64 valido", () => {
      expect(decodeJwtPayload("header.!!!invalid!!!.signature")).toBeNull();
    });

    it("dovrebbe restituire null per un token vuoto", () => {
      expect(decodeJwtPayload("")).toBeNull();
    });

    it("dovrebbe gestire caratteri base64url (- e _)", () => {
      // Base64url usa - al posto di + e _ al posto di /
      const payload = { sub: "user+test/value" };
      const jsonStr = JSON.stringify(payload);
      // Codifica in base64 standard e poi converti in base64url
      const base64 = btoa(jsonStr);
      const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const token = `header.${base64url}.signature`;

      const decoded = decodeJwtPayload(token);
      expect(decoded).toEqual(payload);
    });
  });

  // ─── isAuthenticated ───────────────────────────────────────────

  describe("isAuthenticated", () => {
    it("dovrebbe restituire true quando esiste un JWT valido e non scaduto", () => {
      const authToken = createValidAuthToken();
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      expect(isAuthenticated()).toBe(true);
    });

    it("dovrebbe restituire false quando non esiste un token in localStorage", () => {
      expect(isAuthenticated()).toBe(false);
    });

    it("dovrebbe restituire false quando il JWT e' scaduto (exp < now)", () => {
      // Token scaduto 1 ora fa
      const expiredTime = Math.floor(Date.now() / 1000) - 3600;
      const authToken = createValidAuthToken(expiredTime);
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      expect(isAuthenticated()).toBe(false);
    });

    it("dovrebbe restituire false quando il JWT e' malformato", () => {
      const authToken = { token: "not-a-valid-jwt", refreshToken: "ref" };
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      expect(isAuthenticated()).toBe(false);
    });

    it("dovrebbe restituire false quando il payload JWT non ha il claim exp", () => {
      const tokenWithoutExp = createTestJwt({ sub: "user1", name: "No Exp" });
      const authToken = { token: tokenWithoutExp, refreshToken: "ref" };
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      expect(isAuthenticated()).toBe(false);
    });

    it("dovrebbe restituire false quando exp non e' un numero", () => {
      const tokenWithStringExp = createTestJwt({ sub: "user1", exp: "not-a-number" });
      const authToken = { token: tokenWithStringExp, refreshToken: "ref" };
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      expect(isAuthenticated()).toBe(false);
    });

    it("dovrebbe restituire false quando il token e' null", () => {
      const authToken = { token: null, refreshToken: "ref" };
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      expect(isAuthenticated()).toBe(false);
    });

    it("dovrebbe restituire false quando il token e' una stringa vuota", () => {
      const authToken = { token: "", refreshToken: "ref" };
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      expect(isAuthenticated()).toBe(false);
    });

    it("dovrebbe restituire true per un token che scade esattamente tra 1 secondo", () => {
      const expInOneSecond = Math.floor(Date.now() / 1000) + 1;
      const authToken = createValidAuthToken(expInOneSecond);
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      expect(isAuthenticated()).toBe(true);
    });
  });

  // ─── getAuthHeaders ────────────────────────────────────────────

  describe("getAuthHeaders", () => {
    it("dovrebbe restituire l'header Authorization Bearer quando il token esiste", () => {
      const authToken: AuthToken = { token: "my-jwt-token", refreshToken: "ref" };
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      const headers = getAuthHeaders();
      expect(headers).toEqual({ Authorization: "Bearer my-jwt-token" });
    });

    it("dovrebbe restituire null quando non esiste un token", () => {
      const headers = getAuthHeaders();
      expect(headers).toBeNull();
    });

    it("dovrebbe restituire null quando il token e' vuoto", () => {
      const authToken = { token: "", refreshToken: "ref" };
      localStorage.setItem("jwtToken", JSON.stringify(authToken));

      const headers = getAuthHeaders();
      // token e' "" che e' falsy, quindi authToken?.token e' falsy
      expect(headers).toBeNull();
    });
  });

  // ─── setRememberPassword / hasRememberPassword / removeRememberPassword ─

  describe("remember password", () => {
    it("dovrebbe salvare remember=true come 1 in localStorage", () => {
      setRememberPassword(true);
      expect(localStorage.getItem("remember")).toBe("1");
    });

    it("dovrebbe salvare remember=false come 0 in localStorage", () => {
      setRememberPassword(false);
      expect(localStorage.getItem("remember")).toBe("0");
    });

    it("hasRememberPassword dovrebbe restituire true quando il valore esiste", () => {
      localStorage.setItem("remember", "1");
      expect(hasRememberPassword()).toBe(true);
    });

    it("hasRememberPassword dovrebbe restituire false quando il valore non esiste", () => {
      expect(hasRememberPassword()).toBe(false);
    });

    it("removeRememberPassword dovrebbe rimuovere il valore da localStorage", () => {
      localStorage.setItem("remember", "1");
      removeRememberPassword();
      expect(localStorage.getItem("remember")).toBeNull();
    });
  });
});
