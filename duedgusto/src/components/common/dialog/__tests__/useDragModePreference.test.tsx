import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ── Mock dello store ────────────────────────────────────────────────────
// L'hook legge useStore((state) => state.utente?.preferenzaDragModale) e applica il
// fallback/normalizzazione a "free". Mockiamo lo store per pilotare il valore di utente.

vi.mock("../../../../store/useStore", () => {
  const mockStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  });
  return { default: mockStore };
});

import useStore from "../../../../store/useStore";
import useDragModePreference from "../useDragModePreference";

const mockUseStore = vi.mocked(useStore);

// Simula lo store applicando il selector a uno stato con l'utente fornito.
function setupStore(utente: unknown) {
  mockUseStore.mockImplementation((selector: (state: Store) => unknown) => selector({ utente } as unknown as Store));
}

describe("useDragModePreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restituisce 'elastic' quando l'utente ha preferenzaDragModale = 'elastic'", () => {
    setupStore({ preferenzaDragModale: "elastic" });
    const { result } = renderHook(() => useDragModePreference());
    expect(result.current).toBe("elastic");
  });

  it("restituisce 'free' quando l'utente ha preferenzaDragModale = 'free'", () => {
    setupStore({ preferenzaDragModale: "free" });
    const { result } = renderHook(() => useDragModePreference());
    expect(result.current).toBe("free");
  });

  it("restituisce 'free' (fallback) quando l'utente è null", () => {
    setupStore(null);
    const { result } = renderHook(() => useDragModePreference());
    expect(result.current).toBe("free");
  });

  it("normalizza a 'free' un valore fuori whitelist letto dallo store", () => {
    setupStore({ preferenzaDragModale: "spring" });
    const { result } = renderHook(() => useDragModePreference());
    expect(result.current).toBe("free");
  });
});
