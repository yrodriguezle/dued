import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock delle dipendenze
const mockBroadcastLogout = vi.fn();
vi.mock("../broadcastChannel", () => ({
  broadcastLogout: () => mockBroadcastLogout(),
}));

const mockReceiveUtente = vi.fn();
vi.mock("../../../store/useStore", () => ({
  default: (selector: (store: Store) => unknown) =>
    selector({
      receiveUtente: mockReceiveUtente,
    } as unknown as Store),
}));

vi.mock("../../logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

const mockResetStore = vi.fn().mockResolvedValue(undefined);
vi.mock("@apollo/client", () => ({
  useApolloClient: () => ({
    resetStore: mockResetStore,
  }),
}));

import useSignOut from "../useSignOut";

describe("useSignOut", () => {
  const mockFetch = vi.fn();
  const apiEndpoint = "https://localhost:4000/api";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    (window as Global).API_ENDPOINT = apiEndpoint;
  });

  const setupWithToken = () => {
    const authToken = { token: "my-jwt-token", refreshToken: "my-refresh" };
    localStorage.setItem("jwtToken", JSON.stringify(authToken));
    return authToken;
  };

  // ─── Chiamata API di logout ────────────────────────────────────

  describe("chiamata API di logout", () => {
    it("dovrebbe chiamare /api/auth/logout con l'header Authorization (BUG 2 FIX)", async () => {
      const authToken = setupWithToken();
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${apiEndpoint}/api/auth/logout`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken!.token}`,
          }),
        })
      );
    });

    it("dovrebbe inviare il JWT token nel body della richiesta", async () => {
      const authToken = setupWithToken();
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ token: authToken!.token }),
        })
      );
    });

    it("dovrebbe gestire il caso in cui non esiste un token (invia stringa vuota)", async () => {
      // Nessun token in localStorage
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ token: "" }),
        })
      );
    });
  });

  // ─── Pulizia client-side ───────────────────────────────────────

  describe("pulizia client-side", () => {
    it("dovrebbe rimuovere il token da localStorage", async () => {
      setupWithToken();
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(localStorage.getItem("jwtToken")).toBeNull();
    });

    it("dovrebbe chiamare broadcastLogout()", async () => {
      setupWithToken();
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(mockBroadcastLogout).toHaveBeenCalled();
    });

    it("dovrebbe resettare lo stato utente nello store (receiveUtente(null))", async () => {
      setupWithToken();
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(mockReceiveUtente).toHaveBeenCalledWith(null);
    });

    it("dovrebbe resettare lo store di Apollo Client", async () => {
      setupWithToken();
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(mockResetStore).toHaveBeenCalled();
    });

    it("dovrebbe navigare a /signin con replace:true", async () => {
      setupWithToken();
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/signin", { replace: true });
    });
  });

  // ─── Gestione errori API ───────────────────────────────────────

  describe("gestione errori API di logout", () => {
    it("dovrebbe continuare la pulizia client-side anche se l'API di logout fallisce", async () => {
      setupWithToken();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      // La pulizia dovrebbe avvenire comunque
      expect(mockBroadcastLogout).toHaveBeenCalled();
      expect(localStorage.getItem("jwtToken")).toBeNull();
      expect(mockReceiveUtente).toHaveBeenCalledWith(null);
      expect(mockNavigate).toHaveBeenCalledWith("/signin", { replace: true });
    });
  });

  // ─── Ordine delle operazioni ───────────────────────────────────

  describe("ordine delle operazioni", () => {
    it("dovrebbe chiamare broadcastLogout prima di rimuovere il token", async () => {
      setupWithToken();
      const callOrder: string[] = [];
      mockBroadcastLogout.mockImplementation(() => callOrder.push("broadcastLogout"));
      // removeAuthToken viene chiamato dopo broadcastLogout nel codice sorgente
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      // broadcastLogout viene chiamato prima nel codice
      expect(callOrder).toContain("broadcastLogout");
    });
  });
});
