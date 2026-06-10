import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock del modulo theme: useStore → themeStore usa window.matchMedia (assente in jsdom)
vi.mock("../../../components/theme/theme", () => ({
  getDefaultTheme: vi.fn(() => "light"),
  getLastUserThemeMode: vi.fn(() => "default"),
  setLastUserThemeMode: vi.fn(),
}));

import useSyncSettingsToStore from "../useSyncSettingsToStore";
import useStore from "../../../store/useStore";
import { RawSettingsData } from "../parseSettingsFromRaw";

const rawConStringheJson: RawSettingsData = {
  businessSettings: {
    settingsId: 1,
    businessName: "DuedGusto",
    openingTime: "09:00:00",
    closingTime: "18:00:00",
    operatingDays: "[true,true,true,true,true,false,false]",
    timezone: "Europe/Rome",
    currency: "EUR",
    vatRate: 0.22,
  },
  periodiProgrammazione: [
    {
      periodoId: 1,
      dataInizio: "2026-01-01",
      dataFine: null,
      giorniOperativi: "[true,true,true,true,true,false,false]",
      orarioApertura: "09:00",
      orarioChiusura: "18:00",
    },
  ],
  giorniNonLavorativi: [
    {
      giornoId: 1,
      data: "2026-12-25",
      descrizione: "Natale",
      codiceMotivo: "FESTIVITA_NAZIONALE",
      ricorrente: true,
      settingsId: 1,
      createdAt: "2026-03-21",
      updatedAt: "2026-03-21",
    },
  ],
};

const rawConArray: RawSettingsData = {
  businessSettings: {
    ...rawConStringheJson.businessSettings!,
    operatingDays: [true, true, true, true, true, false, false],
  },
  periodiProgrammazione: [
    {
      ...rawConStringheJson.periodiProgrammazione![0],
      giorniOperativi: [true, true, true, true, true, false, false],
    },
  ],
  giorniNonLavorativi: rawConStringheJson.giorniNonLavorativi,
};

function resetStore() {
  useStore.setState({
    settings: null,
    periodi: [],
    giorniNonLavorativi: [],
  });
}

describe("useSyncSettingsToStore", () => {
  beforeEach(resetStore);

  it("scrive nello store la shape normalizzata da raw con stringhe JSON", () => {
    const { result } = renderHook(() => useSyncSettingsToStore());

    act(() => {
      result.current(rawConStringheJson);
    });

    const state = useStore.getState();
    expect(state.settings?.operatingDays).toEqual([true, true, true, true, true, false, false]);
    expect(state.settings?.openingTime).toBe("09:00");
    expect(state.settings?.closingTime).toBe("18:00");
    expect(state.periodi[0].giorniOperativi).toEqual([true, true, true, true, true, false, false]);
    expect(state.giorniNonLavorativi).toHaveLength(1);
  });

  it("scrive nello store la stessa shape normalizzata da raw con array (mai stringhe JSON)", () => {
    const { result } = renderHook(() => useSyncSettingsToStore());

    act(() => {
      result.current(rawConArray);
    });

    const state = useStore.getState();
    expect(Array.isArray(state.settings?.operatingDays)).toBe(true);
    expect(state.settings?.operatingDays).toEqual([true, true, true, true, true, false, false]);
    expect(Array.isArray(state.periodi[0].giorniOperativi)).toBe(true);
  });

  it("non azzera i settings esistenti se businessSettings è assente, ma aggiorna periodi e giorni", () => {
    const { result } = renderHook(() => useSyncSettingsToStore());

    act(() => {
      result.current(rawConStringheJson);
    });
    act(() => {
      result.current({ businessSettings: null, periodiProgrammazione: [], giorniNonLavorativi: [] });
    });

    const state = useStore.getState();
    expect(state.settings).not.toBeNull();
    expect(state.periodi).toEqual([]);
    expect(state.giorniNonLavorativi).toEqual([]);
  });

  it("la callback è stabile tra i render (useCallback)", () => {
    const { result, rerender } = renderHook(() => useSyncSettingsToStore());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  describe("store aggiornato dopo una mutation settings senza reload", () => {
    // Lunedì 15/06/2026 (getDay()=1 → indice operatingDays 0)
    const lunedi = new Date(2026, 5, 15);

    it("disattivare il lunedì: isOpen(lunedì) diventa false e getNextOperatingDate lo salta", () => {
      const { result } = renderHook(() => useSyncSettingsToStore());

      act(() => {
        result.current(rawConStringheJson);
      });
      expect(useStore.getState().isOpen(lunedi)).toBe(true);

      // Simula il refetch post-mutation: lunedì disattivato (periodo attivo aggiornato)
      act(() => {
        result.current({
          ...rawConStringheJson,
          businessSettings: {
            ...rawConStringheJson.businessSettings!,
            operatingDays: "[false,true,true,true,true,false,false]",
          },
          periodiProgrammazione: [
            {
              ...rawConStringheJson.periodiProgrammazione![0],
              giorniOperativi: "[false,true,true,true,true,false,false]",
            },
          ],
        });
      });

      const state = useStore.getState();
      expect(state.isOpen(lunedi)).toBe(false);
      const next = state.getNextOperatingDate(lunedi);
      // Il prossimo giorno operativo è martedì 16/06/2026
      expect(next.getDay()).toBe(2);
      expect(next.getDate()).toBe(16);
    });

    it("aggiungere un giorno non lavorativo: isOpen(quella data) diventa false", () => {
      const { result } = renderHook(() => useSyncSettingsToStore());

      act(() => {
        result.current(rawConStringheJson);
      });
      expect(useStore.getState().isOpen(lunedi)).toBe(true);

      act(() => {
        result.current({
          ...rawConStringheJson,
          giorniNonLavorativi: [
            ...rawConStringheJson.giorniNonLavorativi!,
            {
              giornoId: 2,
              data: "2026-06-15",
              descrizione: "Chiusura straordinaria",
              codiceMotivo: "CHIUSURA_STRAORDINARIA",
              ricorrente: false,
              settingsId: 1,
              createdAt: "2026-06-10",
              updatedAt: "2026-06-10",
            },
          ],
        });
      });

      expect(useStore.getState().isOpen(lunedi)).toBe(false);
    });

    it("modificare un periodo di programmazione: isOpen riflette i nuovi giorni operativi", () => {
      const { result } = renderHook(() => useSyncSettingsToStore());

      // Periodo attivo con sabato chiuso
      act(() => {
        result.current(rawConStringheJson);
      });
      const sabato = new Date(2026, 5, 20); // Sabato 20/06/2026
      expect(useStore.getState().isOpen(sabato)).toBe(false);

      // Mutation: periodo aggiornato con sabato aperto
      act(() => {
        result.current({
          ...rawConStringheJson,
          periodiProgrammazione: [
            {
              ...rawConStringheJson.periodiProgrammazione![0],
              giorniOperativi: "[true,true,true,true,true,true,false]",
            },
          ],
        });
      });

      expect(useStore.getState().isOpen(sabato)).toBe(true);
    });
  });
});
