import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock di tutte le dipendenze - NON usare variabili top-level nel factory
vi.mock("../../toast/showToast", () => ({
  default: vi.fn(),
}));

vi.mock("../../../store/useStore", () => ({
  default: {
    getState: vi.fn(),
  },
}));

vi.mock("../../../graphql/configureClient", () => ({
  default: vi.fn(),
}));

vi.mock("../../navigator/navigator", () => ({
  navigateTo: vi.fn(),
}));

vi.mock("../../logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Importa i mock dopo vi.mock
import showToast from "../../toast/showToast";
import useStore from "../../../store/useStore";
import configureClient from "../../../graphql/configureClient";
import { navigateTo } from "../../navigator/navigator";
import onRefreshFails from "../onRefreshFails";

describe("onRefreshFails", () => {
  const mockReceiveUtente = vi.fn();
  const mockResetStore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Imposta un token e remember password in localStorage per verificare la pulizia
    localStorage.setItem("jwtToken", JSON.stringify({ token: "abc", refreshToken: "ref" }));
    localStorage.setItem("remember", "1");

    // Configura i mock
    vi.mocked(useStore.getState).mockReturnValue({
      receiveUtente: mockReceiveUtente,
    } as unknown as Store);

    vi.mocked(configureClient).mockReturnValue({
      resetStore: mockResetStore,
    } as unknown as ReturnType<typeof configureClient>);

    // Mock location.pathname di default a qualcosa diverso da /signin
    Object.defineProperty(window, "location", {
      value: { pathname: "/gestionale/dashboard" },
      writable: true,
      configurable: true,
    });
  });

  it("dovrebbe mostrare un toast di errore con il messaggio 'Utente non autenticato'", async () => {
    await onRefreshFails();

    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      position: "bottom-right",
      message: "Utente non autenticato",
      autoClose: false,
      toastId: "refresh-token-error",
    });
  });

  it("dovrebbe resettare lo stato utente nello store (receiveUtente(null))", async () => {
    await onRefreshFails();

    expect(mockReceiveUtente).toHaveBeenCalledWith(null);
  });

  it("dovrebbe rimuovere il token di autenticazione da localStorage", async () => {
    await onRefreshFails();

    expect(localStorage.getItem("jwtToken")).toBeNull();
  });

  it("dovrebbe rimuovere il remember password da localStorage", async () => {
    await onRefreshFails();

    expect(localStorage.getItem("remember")).toBeNull();
  });

  it("dovrebbe navigare a signin quando il pathname corrente non e' /signin", async () => {
    await onRefreshFails();

    expect(navigateTo).toHaveBeenCalledWith("signin");
  });

  it("dovrebbe resettare lo store di Apollo Client quando il pathname non e' /signin", async () => {
    await onRefreshFails();

    expect(mockResetStore).toHaveBeenCalled();
  });

  it("non dovrebbe navigare ne' resettare Apollo quando gia' su /signin", async () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/signin" },
      writable: true,
      configurable: true,
    });

    await onRefreshFails();

    expect(navigateTo).not.toHaveBeenCalled();
    expect(mockResetStore).not.toHaveBeenCalled();
  });

  it("dovrebbe gestire gli errori senza propagarli (try/catch)", async () => {
    // Simula un errore in receiveUtente
    mockReceiveUtente.mockImplementationOnce(() => {
      throw new Error("Store error");
    });

    // Non dovrebbe lanciare
    await expect(onRefreshFails()).resolves.toBeUndefined();
  });
});
