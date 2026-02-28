import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del modulo refreshToken PRIMA dell'import
vi.mock("../../../api/refreshToken", () => ({
  default: vi.fn(),
}));

// Mock del logger
vi.mock("../../logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import refreshTokenMock from "../../../api/refreshToken";

describe("tokenRefreshManager", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset del modulo per pulire lo stato interno (isRefreshing, pendingCallbacks, refreshPromise)
    vi.resetModules();
  });

  const getModule = async () => {
    return await import("../tokenRefreshManager");
  };

  // ─── executeTokenRefresh ───────────────────────────────────────

  describe("executeTokenRefresh", () => {
    it("dovrebbe chiamare l'API di refresh quando non c'e' un refresh in corso", async () => {
      vi.mocked(refreshTokenMock).mockResolvedValueOnce(true);
      const { executeTokenRefresh } = await getModule();

      const result = await executeTokenRefresh();

      expect(result).toBe(true);
    });

    it("dovrebbe garantire la deduplicazione: una sola chiamata refreshToken anche con chiamate multiple", async () => {
      // Il test verifica che la seconda chiamata non invochi refreshToken una seconda volta
      let resolveRefresh!: (value: boolean) => void;
      let callCount = 0;
      vi.mocked(refreshTokenMock).mockImplementation(() => {
        callCount++;
        return new Promise<boolean>((resolve) => {
          resolveRefresh = resolve;
        });
      });

      const { executeTokenRefresh } = await getModule();

      // Prima chiamata - avvia il refresh
      const promise1 = executeTokenRefresh();
      // Seconda chiamata - dovrebbe riutilizzare il refresh in corso
      const promise2 = executeTokenRefresh();

      // refreshToken dovrebbe essere stato chiamato una sola volta
      expect(callCount).toBe(1);

      // Risolviamo
      resolveRefresh(true);
      const result1 = await promise1;
      const result2 = await promise2;
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it("dovrebbe risolvere i callback pendenti con true in caso di successo", async () => {
      let resolveRefresh!: (value: boolean) => void;
      vi.mocked(refreshTokenMock).mockImplementation(
        () => new Promise<boolean>((resolve) => { resolveRefresh = resolve; })
      );

      const { executeTokenRefresh, onTokenRefreshComplete } = await getModule();

      // Avvia il refresh
      const refreshPromise = executeTokenRefresh();

      // Registra un callback pendente
      const callback = vi.fn();
      onTokenRefreshComplete(callback);

      // Risolvi il refresh con successo
      resolveRefresh(true);
      await refreshPromise;

      expect(callback).toHaveBeenCalledWith(true);
    });

    it("dovrebbe risolvere i callback pendenti con false in caso di fallimento", async () => {
      let resolveRefresh!: (value: boolean) => void;
      vi.mocked(refreshTokenMock).mockImplementation(
        () => new Promise<boolean>((resolve) => { resolveRefresh = resolve; })
      );

      const { executeTokenRefresh, onTokenRefreshComplete } = await getModule();

      const refreshPromise = executeTokenRefresh();

      const callback = vi.fn();
      onTokenRefreshComplete(callback);

      resolveRefresh(false);
      await refreshPromise;

      expect(callback).toHaveBeenCalledWith(false);
    });

    it("dovrebbe gestire un errore nel refresh e notificare i callback con false", async () => {
      let rejectRefresh!: (err: Error) => void;
      vi.mocked(refreshTokenMock).mockImplementation(
        () => new Promise<boolean>((_resolve, reject) => { rejectRefresh = reject; })
      );

      const { executeTokenRefresh, onTokenRefreshComplete } = await getModule();

      const refreshPromise = executeTokenRefresh();
      const callback = vi.fn();
      onTokenRefreshComplete(callback);

      rejectRefresh(new Error("Network error"));
      const result = await refreshPromise;

      expect(result).toBe(false);
      expect(callback).toHaveBeenCalledWith(false);
    });

    it("dovrebbe resettare isRefreshing dopo il completamento (successo)", async () => {
      vi.mocked(refreshTokenMock).mockResolvedValueOnce(true);

      const { executeTokenRefresh, isTokenRefreshInProgress } = await getModule();

      await executeTokenRefresh();

      expect(isTokenRefreshInProgress()).toBe(false);
    });

    it("dovrebbe resettare isRefreshing dopo il completamento (fallimento)", async () => {
      vi.mocked(refreshTokenMock).mockResolvedValueOnce(false);

      const { executeTokenRefresh, isTokenRefreshInProgress } = await getModule();

      await executeTokenRefresh();

      expect(isTokenRefreshInProgress()).toBe(false);
    });
  });

  // ─── isTokenRefreshInProgress ──────────────────────────────────

  describe("isTokenRefreshInProgress", () => {
    it("dovrebbe restituire false inizialmente", async () => {
      const { isTokenRefreshInProgress } = await getModule();

      expect(isTokenRefreshInProgress()).toBe(false);
    });

    it("dovrebbe restituire true durante un refresh attivo", async () => {
      let resolveRefresh!: (value: boolean) => void;
      vi.mocked(refreshTokenMock).mockImplementation(
        () => new Promise<boolean>((resolve) => { resolveRefresh = resolve; })
      );

      const { executeTokenRefresh, isTokenRefreshInProgress } = await getModule();

      // Avvia il refresh (ma non risolvere ancora)
      const refreshPromise = executeTokenRefresh();

      expect(isTokenRefreshInProgress()).toBe(true);

      // Pulizia
      resolveRefresh(true);
      await refreshPromise;
    });
  });

  // ─── onTokenRefreshComplete ────────────────────────────────────

  describe("onTokenRefreshComplete", () => {
    it("dovrebbe registrare il callback e chiamarlo al completamento del refresh", async () => {
      let resolveRefresh!: (value: boolean) => void;
      vi.mocked(refreshTokenMock).mockImplementation(
        () => new Promise<boolean>((resolve) => { resolveRefresh = resolve; })
      );

      const { executeTokenRefresh, onTokenRefreshComplete } = await getModule();

      const refreshPromise = executeTokenRefresh();

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      onTokenRefreshComplete(callback1);
      onTokenRefreshComplete(callback2);

      resolveRefresh(true);
      await refreshPromise;

      expect(callback1).toHaveBeenCalledWith(true);
      expect(callback2).toHaveBeenCalledWith(true);
    });

    it("dovrebbe chiamare il callback immediatamente con false se non c'e' un refresh in corso", async () => {
      const { onTokenRefreshComplete } = await getModule();

      const callback = vi.fn();
      onTokenRefreshComplete(callback);

      expect(callback).toHaveBeenCalledWith(false);
    });
  });
});
