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
        () =>
          new Promise<boolean>((resolve) => {
            resolveRefresh = resolve;
          })
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
        () =>
          new Promise<boolean>((resolve) => {
            resolveRefresh = resolve;
          })
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
        () =>
          new Promise<boolean>((_resolve, reject) => {
            rejectRefresh = reject;
          })
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
        () =>
          new Promise<boolean>((resolve) => {
            resolveRefresh = resolve;
          })
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
        () =>
          new Promise<boolean>((resolve) => {
            resolveRefresh = resolve;
          })
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

  // ─── Gestione concorrente 401 (REQ-1.6.4) ──────────────────────

  describe("gestione concorrente 401", () => {
    it("dovrebbe eseguire un solo refresh anche con tre richieste 401 simultanee", async () => {
      let resolveRefresh!: (value: boolean) => void;
      let callCount = 0;
      vi.mocked(refreshTokenMock).mockImplementation(() => {
        callCount++;
        return new Promise<boolean>((resolve) => {
          resolveRefresh = resolve;
        });
      });

      const { executeTokenRefresh } = await getModule();

      // Simula tre richieste 401 simultanee
      const promise1 = executeTokenRefresh();
      const promise2 = executeTokenRefresh();
      const promise3 = executeTokenRefresh();

      // Solo una chiamata a refreshToken deve essere stata effettuata
      expect(callCount).toBe(1);

      // Risolvi il refresh
      resolveRefresh(true);
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it("dovrebbe riprovare tutte le richieste in coda dopo un refresh riuscito", async () => {
      let resolveRefresh!: (value: boolean) => void;
      vi.mocked(refreshTokenMock).mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveRefresh = resolve;
          })
      );

      const { executeTokenRefresh, onTokenRefreshComplete } = await getModule();

      // Avvia il refresh (prima richiesta 401)
      const refreshPromise = executeTokenRefresh();

      // Registra callback per le richieste in coda (simulate altre 401)
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();
      onTokenRefreshComplete(callback1);
      onTokenRefreshComplete(callback2);
      onTokenRefreshComplete(callback3);

      // Refresh riuscito
      resolveRefresh(true);
      await refreshPromise;

      // Tutti i callback devono essere stati chiamati con true
      expect(callback1).toHaveBeenCalledWith(true);
      expect(callback2).toHaveBeenCalledWith(true);
      expect(callback3).toHaveBeenCalledWith(true);
    });

    it("dovrebbe rifiutare tutte le richieste in coda se il refresh fallisce", async () => {
      let resolveRefresh!: (value: boolean) => void;
      vi.mocked(refreshTokenMock).mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveRefresh = resolve;
          })
      );

      const { executeTokenRefresh, onTokenRefreshComplete } = await getModule();

      // Avvia il refresh
      const refreshPromise = executeTokenRefresh();

      // Registra callback per le richieste in coda
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();
      onTokenRefreshComplete(callback1);
      onTokenRefreshComplete(callback2);
      onTokenRefreshComplete(callback3);

      // Refresh fallito
      resolveRefresh(false);
      await refreshPromise;

      // Tutti i callback devono essere stati chiamati con false
      expect(callback1).toHaveBeenCalledWith(false);
      expect(callback2).toHaveBeenCalledWith(false);
      expect(callback3).toHaveBeenCalledWith(false);
    });

    it("dovrebbe rifiutare tutte le richieste in coda se il refresh lancia un errore", async () => {
      let rejectRefresh!: (err: Error) => void;
      vi.mocked(refreshTokenMock).mockImplementation(
        () =>
          new Promise<boolean>((_resolve, reject) => {
            rejectRefresh = reject;
          })
      );

      const { executeTokenRefresh, onTokenRefreshComplete } = await getModule();

      // Avvia il refresh
      const refreshPromise = executeTokenRefresh();

      // Registra callback
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      onTokenRefreshComplete(callback1);
      onTokenRefreshComplete(callback2);

      // Refresh con errore
      rejectRefresh(new Error("Server error"));
      const result = await refreshPromise;

      expect(result).toBe(false);
      expect(callback1).toHaveBeenCalledWith(false);
      expect(callback2).toHaveBeenCalledWith(false);
    });

    it("dovrebbe permettere un nuovo refresh dopo che il precedente e' completato", async () => {
      let callCount = 0;
      vi.mocked(refreshTokenMock).mockImplementation(() => {
        callCount++;
        return Promise.resolve(true);
      });

      const { executeTokenRefresh, isTokenRefreshInProgress } = await getModule();

      // Primo refresh
      await executeTokenRefresh();
      expect(callCount).toBe(1);
      expect(isTokenRefreshInProgress()).toBe(false);

      // Secondo refresh (dovrebbe avviare una nuova chiamata)
      await executeTokenRefresh();
      expect(callCount).toBe(2);
      expect(isTokenRefreshInProgress()).toBe(false);
    });
  });
});
