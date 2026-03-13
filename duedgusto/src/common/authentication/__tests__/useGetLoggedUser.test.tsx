import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock delle dipendenze — vi.mock e' hoisted, non referenziare variabili esterne
vi.mock("../../../graphql/utente/fetchLoggedUser", () => ({
  default: vi.fn(),
}));

// Mock dello store Zustand con stato controllabile
let mockInProgressFetchUser = false;
const mockReceiveUtente = vi.fn();
const mockOnInProgress = vi.fn();
const mockOffInProgress = vi.fn();

vi.mock("../../../store/useStore", () => ({
  default: (selector: (store: Store) => unknown) =>
    selector({
      receiveUtente: mockReceiveUtente,
      inProgress: { get fetchUser() { return mockInProgressFetchUser; } },
      onInProgress: mockOnInProgress,
      offInProgress: mockOffInProgress,
    } as unknown as Store),
}));

// Import dopo i mock
import fetchLoggedUtente from "../../../graphql/utente/fetchLoggedUser";
import useGetLoggedUtente from "../useGetLoggedUser";

describe("useGetLoggedUtente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInProgressFetchUser = false;
  });

  // ─── Ritorna i dati utente con sessione valida ──────────────────

  it("dovrebbe restituire i dati utente quando la sessione e' valida", async () => {
    const mockUtente = {
      id: 1,
      username: "admin",
      ruolo: { id: 1, nome: "Admin" },
      menus: [],
    };

    vi.mocked(fetchLoggedUtente).mockResolvedValueOnce({
      data: {
        authentication: {
          utenteCorrente: mockUtente,
        },
      },
    } as never);

    const { result } = renderHook(() => useGetLoggedUtente());

    const utente = await result.current();

    expect(utente).toEqual(mockUtente);
    expect(mockReceiveUtente).toHaveBeenCalledWith(mockUtente);
    expect(mockOnInProgress).toHaveBeenCalledWith("fetchUser");
    expect(mockOffInProgress).toHaveBeenCalledWith("fetchUser");
  });

  // ─── Ritorna null senza sessione ────────────────────────────────

  it("dovrebbe restituire null quando non c'e' una sessione valida", async () => {
    vi.mocked(fetchLoggedUtente).mockResolvedValueOnce({
      data: {
        authentication: {
          utenteCorrente: null,
        },
      },
    } as never);

    const { result } = renderHook(() => useGetLoggedUtente());

    const utente = await result.current();

    expect(utente).toBeNull();
    expect(mockReceiveUtente).not.toHaveBeenCalled();
  });

  // ─── Ritorna null quando data e' undefined ──────────────────────

  it("dovrebbe restituire null quando data e' undefined", async () => {
    vi.mocked(fetchLoggedUtente).mockResolvedValueOnce({
      data: null,
    } as never);

    const { result } = renderHook(() => useGetLoggedUtente());

    const utente = await result.current();

    expect(utente).toBeNull();
  });

  // ─── Non esegue se fetchUser e' gia' in corso ──────────────────

  it("dovrebbe restituire null se un fetch e' gia' in corso", async () => {
    mockInProgressFetchUser = true;

    const { result } = renderHook(() => useGetLoggedUtente());

    const utente = await result.current();

    expect(utente).toBeNull();
    expect(fetchLoggedUtente).not.toHaveBeenCalled();
  });

  // ─── Gestione transizione stati loading ─────────────────────────

  it("dovrebbe chiamare offInProgress anche in caso di errore (finally block)", async () => {
    vi.mocked(fetchLoggedUtente).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useGetLoggedUtente());

    await expect(result.current()).rejects.toThrow("Network error");

    expect(mockOnInProgress).toHaveBeenCalledWith("fetchUser");
    expect(mockOffInProgress).toHaveBeenCalledWith("fetchUser");
  });
});
