import { describe, it, expect } from "vitest";
import { create } from "zustand";
import businessSettingsStore from "../businessSettingsStore";

type BusinessSettingsSlice = Pick<
  Store,
  | "settings"
  | "setSettings"
  | "periodi"
  | "setPeriodi"
  | "giorniNonLavorativi"
  | "setGiorniNonLavorativi"
  | "isOpen"
  | "isOpenNow"
  | "getNextOperatingDate"
  | "getOpeningTime"
  | "getClosingTime"
  | "settingsLoaded"
  | "setSettingsLoaded"
  | "settingsError"
  | "setSettingsError"
>;

const createStore = () =>
  create<BusinessSettingsSlice>((set, get) => ({
    ...businessSettingsStore(set, get as () => Store),
  }));

const mockSettings: BusinessSettings = {
  settingsId: 1,
  businessName: "DuedGusto",
  openingTime: "09:00",
  closingTime: "18:00",
  operatingDays: [true, true, true, true, true, false, false], // lun-ven aperto
  timezone: "Europe/Rome",
  currency: "EUR",
  vatRate: 0.22,
};

const mockPeriodo: PeriodoProgrammazione = {
  periodoId: 1,
  dataInizio: "2026-01-01",
  dataFine: null, // periodo attivo
  giorniOperativi: [true, true, true, true, true, false, false],
  orarioApertura: "09:00",
  orarioChiusura: "18:00",
  settingsId: 1,
};

// =====================================================================
// Test: Giorni Non Lavorativi — isOpen()
// =====================================================================

describe("isOpen() con giorni non lavorativi", () => {
  it("un giorno non lavorativo non ricorrente blocca isOpen()", () => {
    const store = createStore();
    store.getState().setSettings(mockSettings);
    store.getState().setGiorniNonLavorativi([
      {
        giornoId: 1,
        data: "2026-03-23", // lunedì
        descrizione: "Chiusura straordinaria",
        codiceMotivo: "CHIUSURA_STRAORDINARIA",
        ricorrente: false,
        settingsId: 1,
        creatoIl: "2026-03-21",
        aggiornatoIl: "2026-03-21",
      },
    ]);

    // Lunedì 23 marzo 2026 — normalmente operativo, ma è giorno non lavorativo
    const lunedi23 = new Date(2026, 2, 23);
    expect(store.getState().isOpen(lunedi23)).toBe(false);

    // Lunedì 30 marzo 2026 — non bloccato (non ricorrente)
    const lunedi30 = new Date(2026, 2, 30);
    expect(store.getState().isOpen(lunedi30)).toBe(true);
  });

  it("un giorno non lavorativo ricorrente blocca ogni anno", () => {
    const store = createStore();
    store.getState().setSettings(mockSettings);
    store.getState().setGiorniNonLavorativi([
      {
        giornoId: 2,
        data: "2026-12-25", // Natale, giovedì
        descrizione: "Natale",
        codiceMotivo: "FESTIVITA_NAZIONALE",
        ricorrente: true,
        settingsId: 1,
        creatoIl: "2026-03-21",
        aggiornatoIl: "2026-03-21",
      },
    ]);

    // 25 dicembre 2026 (venerdì) — chiuso
    const natale2026 = new Date(2026, 11, 25);
    expect(store.getState().isOpen(natale2026)).toBe(false);

    // 25 dicembre 2027 (sabato) — chiuso (già chiuso di sabato, ma il check vale comunque)
    const natale2027 = new Date(2027, 11, 25);
    expect(store.getState().isOpen(natale2027)).toBe(false);
  });

  it("isOpen() con periodi + giorno non lavorativo", () => {
    const store = createStore();
    store.getState().setSettings(mockSettings);
    store.getState().setPeriodi([mockPeriodo]);
    store.getState().setGiorniNonLavorativi([
      {
        giornoId: 3,
        data: "2026-03-23",
        descrizione: "Chiusura",
        codiceMotivo: "CHIUSURA_STRAORDINARIA",
        ricorrente: false,
        settingsId: 1,
        creatoIl: "2026-03-21",
        aggiornatoIl: "2026-03-21",
      },
    ]);

    // Il periodo dice aperto lunedì, ma è giorno non lavorativo
    const lunedi23 = new Date(2026, 2, 23);
    expect(store.getState().isOpen(lunedi23)).toBe(false);

    // Martedì 24 marzo - aperto normalmente
    const martedi24 = new Date(2026, 2, 24);
    expect(store.getState().isOpen(martedi24)).toBe(true);
  });

  it("getNextOperatingDate() salta i giorni non lavorativi", () => {
    const store = createStore();
    store.getState().setSettings(mockSettings);
    store.getState().setGiorniNonLavorativi([
      {
        giornoId: 4,
        data: "2026-03-23", // lunedì
        descrizione: "Chiusura",
        codiceMotivo: "CHIUSURA_STRAORDINARIA",
        ricorrente: false,
        settingsId: 1,
        creatoIl: "2026-03-21",
        aggiornatoIl: "2026-03-21",
      },
    ]);

    // Da domenica 22 (chiuso) → lunedì 23 (non lavorativo) → martedì 24 (aperto)
    const domenica22 = new Date(2026, 2, 22);
    const prossimo = store.getState().getNextOperatingDate(domenica22);
    expect(prossimo.getDate()).toBe(24);
  });
});

// =====================================================================
// BUG TEST: operatingDays come stringa (dati raw non parsati)
// =====================================================================

describe("BUG: isOpen() con operatingDays come stringa (dati raw dal server)", () => {
  it("DEVE fallire se operatingDays è una stringa JSON non parsata", () => {
    const store = createStore();
    // Simula dati raw dal server senza parsing
    store.getState().setSettings({
      ...mockSettings,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      operatingDays: "[true,true,true,true,true,false,false]" as any,
    });

    // Lunedì 23 marzo 2026 — dovrebbe essere aperto ma con stringa non parsata fallisce
    const lunedi = new Date(2026, 2, 23);
    // Il bug: string[0] === "[" che non è === true, quindi ritorna false
    expect(store.getState().isOpen(lunedi)).toBe(false);
  });

  it("funziona correttamente con operatingDays come array boolean", () => {
    const store = createStore();
    store.getState().setSettings({
      ...mockSettings,
      operatingDays: [true, true, true, true, true, false, false],
    });

    const lunedi = new Date(2026, 2, 23);
    expect(store.getState().isOpen(lunedi)).toBe(true);
  });
});

describe("BUG: isOpen() con periodi.giorniOperativi come stringa (dati raw dal server)", () => {
  it("DEVE fallire se giorniOperativi del periodo è una stringa JSON non parsata", () => {
    const store = createStore();
    store.getState().setSettings(mockSettings);
    store.getState().setPeriodi([
      {
        ...mockPeriodo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        giorniOperativi: "[true,true,true,true,true,false,false]" as any,
      },
    ]);

    // Con periodo attivo, isOpen usa periodo.giorniOperativi
    // Se è stringa, string[0] === "[" che non è === true
    const lunedi = new Date(2026, 2, 23);
    expect(store.getState().isOpen(lunedi)).toBe(false);
  });

  it("funziona correttamente con giorniOperativi come array boolean", () => {
    const store = createStore();
    store.getState().setSettings(mockSettings);
    store.getState().setPeriodi([mockPeriodo]);

    const lunedi = new Date(2026, 2, 23);
    expect(store.getState().isOpen(lunedi)).toBe(true);
  });
});
