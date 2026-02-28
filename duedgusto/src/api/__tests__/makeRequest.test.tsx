import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock di tutte le dipendenze del modulo
vi.mock("../../common/authentication/auth", () => ({
  getAuthHeaders: vi.fn(),
}));

vi.mock("../../common/authentication/onRefreshFails", () => ({
  default: vi.fn(),
}));

vi.mock("../../common/authentication/tokenRefreshManager", () => ({
  executeTokenRefresh: vi.fn(),
}));

vi.mock("../../common/logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getAuthHeaders } from "../../common/authentication/auth";
import onRefreshFails from "../../common/authentication/onRefreshFails";
import { executeTokenRefresh } from "../../common/authentication/tokenRefreshManager";

describe("makeRequest", () => {
  const mockFetch = vi.fn();
  const apiEndpoint = "https://localhost:4000/api";

  // Dobbiamo re-importare makeRequest DOPO aver mockato fetch per ogni test
  // perche' defaultServices cattura window.fetch.bind(window) all'import
  let makeRequest: typeof import("../makeRequest").default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getAuthHeaders).mockReturnValue({ Authorization: "Bearer test-jwt" });
    vi.mocked(onRefreshFails).mockResolvedValue(undefined);
    vi.mocked(executeTokenRefresh).mockResolvedValue(false);
    (window as Global).API_ENDPOINT = apiEndpoint;

    // Mock globale di window.fetch PRIMA di importare il modulo
    vi.stubGlobal("fetch", mockFetch);

    // Reset e re-importa il modulo per catturare il fetch mockato in defaultServices
    vi.resetModules();
    const module = await import("../makeRequest");
    makeRequest = module.default;
  });

  // Helper per creare mock Response
  const createMockResponse = (
    status: number,
    body?: unknown,
    options?: { contentLength?: string }
  ) => {
    const responseText = body !== undefined ? JSON.stringify(body) : "";
    return {
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(body),
      clone: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue(responseText),
      }),
      text: vi.fn().mockResolvedValue(responseText),
      headers: {
        get: vi.fn((header: string) => {
          if (header === "content-length") return options?.contentLength ?? String(responseText.length);
          return null;
        }),
      },
    };
  };

  // ─── Richieste con successo ────────────────────────────────────

  describe("richieste con successo", () => {
    it("dovrebbe effettuare una richiesta fetch con gli header corretti (Authorization)", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, { data: "test" }));

      await makeRequest({ path: "test/endpoint", method: "GET" });

      expect(mockFetch).toHaveBeenCalledWith(
        `${apiEndpoint}/api/test/endpoint`,
        expect.objectContaining({
          method: "GET",
          credentials: "include",
          headers: expect.objectContaining({
            Accept: "application/json",
            "Content-Type": "application/json;charset=UTF-8",
            Authorization: "Bearer test-jwt",
          }),
        })
      );
    });

    it("dovrebbe restituire i dati JSON dalla risposta", async () => {
      const responseData = { id: 1, name: "test" };
      mockFetch.mockResolvedValueOnce(createMockResponse(200, responseData));

      const result = await makeRequest({ path: "test/endpoint", method: "GET" });

      expect(result).toEqual(responseData);
    });

    it("dovrebbe restituire null quando content-length e' 0", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, undefined, { contentLength: "0" })
      );

      const result = await makeRequest({ path: "test/endpoint", method: "GET" });

      expect(result).toBeNull();
    });

    it("dovrebbe restituire null quando il body della risposta e' vuoto", async () => {
      const response = createMockResponse(200, undefined);
      response.clone.mockReturnValue({
        text: vi.fn().mockResolvedValue(""),
      });
      response.headers.get.mockReturnValue("10");
      mockFetch.mockResolvedValueOnce(response);

      const result = await makeRequest({ path: "test/endpoint", method: "GET" });

      expect(result).toBeNull();
    });

    it("dovrebbe inviare il body JSON per richieste POST con data", async () => {
      const postData = { username: "test", password: "pass" };
      mockFetch.mockResolvedValueOnce(createMockResponse(200, { success: true }));

      await makeRequest({ path: "auth/login", method: "POST", data: postData });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(postData),
        })
      );
    });

    it("dovrebbe inviare body undefined quando data non e' fornito", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, { data: "test" }));

      await makeRequest({ path: "test/endpoint", method: "GET" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: undefined,
        })
      );
    });
  });

  // ─── Header personalizzati ─────────────────────────────────────

  describe("header personalizzati", () => {
    it("dovrebbe fare il merge degli header personalizzati con quelli di default", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, { data: "test" }));

      await makeRequest({
        path: "test/endpoint",
        method: "GET",
        headers: { "X-Custom-Header": "custom-value" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "custom-value",
            Authorization: "Bearer test-jwt",
          }),
        })
      );
    });

    it("dovrebbe funzionare senza header di autenticazione quando getAuthHeaders restituisce null", async () => {
      vi.mocked(getAuthHeaders).mockReturnValue(null);
      mockFetch.mockResolvedValueOnce(createMockResponse(200, { data: "test" }));

      await makeRequest({ path: "test/endpoint", method: "GET" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/json",
            "Content-Type": "application/json;charset=UTF-8",
          }),
        })
      );
    });
  });

  // ─── Gestione 401 con token refresh ────────────────────────────

  describe("gestione 401 (token refresh)", () => {
    it("dovrebbe attivare il refresh del token su risposta 401", async () => {
      vi.mocked(executeTokenRefresh).mockResolvedValueOnce(true);
      // Prima chiamata: 401, seconda (retry dopo refresh): 200
      mockFetch
        .mockResolvedValueOnce(createMockResponse(401))
        .mockResolvedValueOnce(createMockResponse(200, { data: "retried" }));

      const result = await makeRequest({ path: "test/endpoint", method: "GET" });

      expect(executeTokenRefresh).toHaveBeenCalledOnce();
      expect(result).toEqual({ data: "retried" });
    });

    it("dovrebbe chiamare onRefreshFails quando il refresh fallisce", async () => {
      vi.mocked(executeTokenRefresh).mockResolvedValueOnce(false);
      mockFetch.mockResolvedValueOnce(createMockResponse(401));

      const result = await makeRequest({ path: "test/endpoint", method: "GET" });

      expect(onRefreshFails).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("non dovrebbe ritentare quando failOnForbidden e' true (401 diventa errore generico)", async () => {
      const jsonResponse = { message: "Non autorizzato" };
      const response401 = createMockResponse(401);
      response401.json.mockResolvedValue(jsonResponse);
      mockFetch.mockResolvedValueOnce(response401);

      // Con failOnForbidden=true, il codice non entra nel blocco 401+refresh
      await expect(
        makeRequest({ path: "test/endpoint", method: "GET", failOnForbidden: true })
      ).rejects.toThrow("Non autorizzato");

      expect(executeTokenRefresh).not.toHaveBeenCalled();
    });

    it("dovrebbe passare failOnForbidden=true nella chiamata di retry dopo il refresh", async () => {
      vi.mocked(executeTokenRefresh).mockResolvedValueOnce(true);
      // Il retry usa failOnForbidden=true per evitare loop infiniti
      const retryErrorJson = { message: "Ancora non autorizzato" };
      const retryResponse = createMockResponse(401);
      retryResponse.json.mockResolvedValue(retryErrorJson);

      mockFetch
        .mockResolvedValueOnce(createMockResponse(401))  // Prima richiesta
        .mockResolvedValueOnce(retryResponse);             // Retry dopo refresh

      // Il retry riceve 401, ma con failOnForbidden=true non tenta il refresh
      await expect(
        makeRequest({ path: "test/endpoint", method: "GET" })
      ).rejects.toThrow("Ancora non autorizzato");

      expect(executeTokenRefresh).toHaveBeenCalledOnce();
    });
  });

  // ─── Errore 403 ────────────────────────────────────────────────

  describe("errore 403 (Forbidden)", () => {
    it("dovrebbe lanciare un errore 'Richiesta non autorizzata' per 403", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(403));

      await expect(
        makeRequest({ path: "test/endpoint", method: "GET" })
      ).rejects.toThrow("Richiesta non autorizzata");
    });
  });

  // ─── Altri errori ──────────────────────────────────────────────

  describe("altri errori HTTP", () => {
    it("dovrebbe lanciare un errore con il messaggio dalla risposta JSON", async () => {
      const errorResponse = { message: "Errore personalizzato dal server" };
      const response = createMockResponse(400);
      response.json.mockResolvedValue(errorResponse);
      mockFetch.mockResolvedValueOnce(response);

      await expect(
        makeRequest({ path: "test/endpoint", method: "GET" })
      ).rejects.toThrow("Errore personalizzato dal server");
    });

    it("dovrebbe usare un messaggio di fallback quando la risposta JSON non ha message", async () => {
      const errorResponse = {};
      const response = createMockResponse(422);
      response.json.mockResolvedValue(errorResponse);
      mockFetch.mockResolvedValueOnce(response);

      await expect(
        makeRequest({ path: "test/endpoint", method: "GET" })
      ).rejects.toThrow("Errore nella risposta del server");
    });
  });
});
