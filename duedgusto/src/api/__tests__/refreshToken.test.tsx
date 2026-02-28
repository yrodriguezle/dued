import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock delle dipendenze
vi.mock("../../common/authentication/auth", () => ({
  getAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
}));

vi.mock("../../common/authentication/broadcastChannel", () => ({
  broadcastTokenRefreshed: vi.fn(),
}));

vi.mock("../../common/logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getAuthToken, setAuthToken } from "../../common/authentication/auth";
import { broadcastTokenRefreshed } from "../../common/authentication/broadcastChannel";
import refreshToken from "../refreshToken";

describe("refreshToken", () => {
  const mockFetch = vi.fn();
  const apiEndpoint = "https://localhost:4000/api";

  const existingToken: AuthToken = {
    token: "old-jwt",
    refreshToken: "old-refresh",
  };

  const newTokenResponse: AuthToken = {
    token: "new-jwt",
    refreshToken: "new-refresh",
  };

  const services = {
    fetch: mockFetch,
    getAuthToken: vi.mocked(getAuthToken),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(getAuthToken).mockReturnValue(existingToken);

    // Configura window.API_ENDPOINT
    (window as Global).API_ENDPOINT = apiEndpoint;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper per creare una Response mock
  const createMockResponse = (status: number, body?: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body ?? {}),
  });

  // ─── Successo ──────────────────────────────────────────────────

  describe("richiesta di refresh con successo", () => {
    it("dovrebbe inviare la richiesta POST corretta con il token corrente", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, newTokenResponse));

      const promise = refreshToken(services);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockFetch).toHaveBeenCalledWith(
        `${apiEndpoint}/api/auth/refresh`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            token: existingToken!.token,
            refreshToken: existingToken!.refreshToken,
          }),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json;charset=UTF-8",
          },
        })
      );
    });

    it("dovrebbe chiamare setAuthToken con la risposta in caso di successo", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, newTokenResponse));

      const promise = refreshToken(services);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(true);
      expect(setAuthToken).toHaveBeenCalledWith(newTokenResponse);
    });

    it("dovrebbe chiamare broadcastTokenRefreshed con il nuovo token", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(200, newTokenResponse));

      const promise = refreshToken(services);
      await vi.runAllTimersAsync();
      await promise;

      expect(broadcastTokenRefreshed).toHaveBeenCalledWith(newTokenResponse);
    });
  });

  // ─── Errori non ritentabili ────────────────────────────────────

  describe("errori non ritentabili", () => {
    it("dovrebbe restituire false per errore 401 senza ritentare", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(401));

      const promise = refreshToken(services);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it("dovrebbe restituire false per errore 403 senza ritentare", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(403));

      const promise = refreshToken(services);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  // ─── Retry con backoff ─────────────────────────────────────────

  describe("retry con backoff esponenziale", () => {
    it("dovrebbe ritentare su errore 429 (Too Many Requests)", async () => {
      // Prima chiamata: 429, seconda: 200
      mockFetch
        .mockResolvedValueOnce(createMockResponse(429))
        .mockResolvedValueOnce(createMockResponse(200, newTokenResponse));

      const promise = refreshToken(services);

      // Avanza i timer per il backoff delay (1000ms * 2^0 = 1000ms)
      await vi.advanceTimersByTimeAsync(1100);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("dovrebbe ritentare su errore 500 (Server Error)", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(500))
        .mockResolvedValueOnce(createMockResponse(200, newTokenResponse));

      const promise = refreshToken(services);
      await vi.advanceTimersByTimeAsync(1100);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("dovrebbe ritentare su errore 503 (Service Unavailable)", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(503))
        .mockResolvedValueOnce(createMockResponse(200, newTokenResponse));

      const promise = refreshToken(services);
      await vi.advanceTimersByTimeAsync(1100);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("dovrebbe lanciare un errore dopo aver esaurito i retry (MAX_RETRIES=3)", async () => {
      // Flusso: retryCount 0,1,2 -> isRetryable e riprova; retryCount 3 -> throw
      mockFetch
        .mockResolvedValueOnce(createMockResponse(500))  // retryCount=0
        .mockResolvedValueOnce(createMockResponse(500))  // retryCount=1
        .mockResolvedValueOnce(createMockResponse(500))  // retryCount=2
        .mockResolvedValueOnce(createMockResponse(500)); // retryCount=3

      // Cattura la rejection immediatamente per evitare "unhandled rejection" con fake timers
      let caughtError: Error | null = null;
      const promise = refreshToken(services).catch((err: Error) => {
        caughtError = err;
      });

      // Avanza tutti i timer per completare i retry con backoff
      await vi.advanceTimersByTimeAsync(10000);
      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe("Error refreshing token: 500");
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("dovrebbe ritentare su errori di rete (fetch rejection)", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(createMockResponse(200, newTokenResponse));

      const promise = refreshToken(services);
      await vi.advanceTimersByTimeAsync(1100);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Token assente ─────────────────────────────────────────────

  describe("quando il token non esiste", () => {
    it("dovrebbe inviare stringhe vuote quando getAuthToken restituisce null", async () => {
      vi.mocked(getAuthToken).mockReturnValue(null);
      mockFetch.mockResolvedValueOnce(createMockResponse(200, newTokenResponse));

      const promise = refreshToken(services);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            token: "",
            refreshToken: "",
          }),
        })
      );
    });
  });
});
