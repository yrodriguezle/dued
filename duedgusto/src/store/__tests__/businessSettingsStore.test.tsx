import { create } from "zustand";
import businessSettingsStore from "../businessSettingsStore";

const createBusinessSettingsStore = () => {
  type BusinessSettingsSlice = Pick<Store, "settings" | "setSettings" | "isOpen" | "isOpenNow" | "getNextOperatingDate" | "getOpeningTime" | "getClosingTime">;
  return create<BusinessSettingsSlice>((set, get) => ({
    ...businessSettingsStore(set, get as () => Store),
  }));
};

const mockSettings: BusinessSettings = {
  settingsId: 1,
  businessName: "DuedGusto",
  openingTime: "09:00",
  closingTime: "18:00",
  operatingDays: [true, true, true, true, true, false, false], // lun-ven aperto, sab-dom chiuso
  timezone: "Europe/Rome",
  currency: "EUR",
  vatRate: 0.22,
};

describe("businessSettingsStore", () => {
  it("deve avere stato iniziale con settings null", () => {
    const store = createBusinessSettingsStore();
    const state = store.getState();

    expect(state.settings).toBeNull();
  });

  it("deve aggiornare settings tramite setSettings", () => {
    const store = createBusinessSettingsStore();

    store.getState().setSettings(mockSettings);

    const state = store.getState();
    expect(state.settings).not.toBeNull();
    expect(state.settings?.businessName).toBe("DuedGusto");
    expect(state.settings?.openingTime).toBe("09:00");
    expect(state.settings?.closingTime).toBe("18:00");
    expect(state.settings?.currency).toBe("EUR");
    expect(state.settings?.vatRate).toBe(0.22);
  });

  it("deve aggiornare tutti i campi delle settings", () => {
    const store = createBusinessSettingsStore();
    const newSettings: BusinessSettings = {
      settingsId: 2,
      businessName: "DuedGusto 2.0",
      openingTime: "08:00",
      closingTime: "22:00",
      operatingDays: [true, true, true, true, true, true, false],
      timezone: "Europe/London",
      currency: "GBP",
      vatRate: 0.20,
    };

    store.getState().setSettings(newSettings);

    const state = store.getState();
    expect(state.settings?.businessName).toBe("DuedGusto 2.0");
    expect(state.settings?.openingTime).toBe("08:00");
    expect(state.settings?.closingTime).toBe("22:00");
    expect(state.settings?.timezone).toBe("Europe/London");
    expect(state.settings?.currency).toBe("GBP");
    expect(state.settings?.vatRate).toBe(0.20);
  });

  it("deve sostituire completamente le settings con setSettings", () => {
    const store = createBusinessSettingsStore();

    store.getState().setSettings(mockSettings);
    expect(store.getState().settings?.businessName).toBe("DuedGusto");

    const newSettings: BusinessSettings = {
      ...mockSettings,
      businessName: "Nuovo Nome",
    };
    store.getState().setSettings(newSettings);
    expect(store.getState().settings?.businessName).toBe("Nuovo Nome");
  });

  it("deve ritornare false da isOpen quando non ci sono settings", () => {
    const store = createBusinessSettingsStore();
    const monday = new Date(2026, 2, 9); // 9 marzo 2026, lunedì

    // Senza settings, assume chiuso
    expect(store.getState().isOpen(monday)).toBe(false);
  });

  it("deve verificare isOpen per giorni operativi", () => {
    const store = createBusinessSettingsStore();
    store.getState().setSettings(mockSettings);

    // Lunedì 9 marzo 2026 - operativo (indice 0 = true)
    const monday = new Date(2026, 2, 9);
    expect(store.getState().isOpen(monday)).toBe(true);

    // Sabato 14 marzo 2026 - chiuso (indice 5 = false)
    const saturday = new Date(2026, 2, 14);
    expect(store.getState().isOpen(saturday)).toBe(false);

    // Domenica 15 marzo 2026 - chiuso (indice 6 = false)
    const sunday = new Date(2026, 2, 15);
    expect(store.getState().isOpen(sunday)).toBe(false);
  });

  it("deve ritornare orario di apertura e chiusura", () => {
    const store = createBusinessSettingsStore();

    // Senza settings
    expect(store.getState().getOpeningTime()).toBeNull();
    expect(store.getState().getClosingTime()).toBeNull();

    store.getState().setSettings(mockSettings);

    expect(store.getState().getOpeningTime()).toBe("09:00");
    expect(store.getState().getClosingTime()).toBe("18:00");
  });

  it("deve trovare la prossima data operativa", () => {
    const store = createBusinessSettingsStore();
    store.getState().setSettings(mockSettings);

    // Da sabato 14 marzo 2026 (chiuso) deve trovare lunedì 16 marzo 2026
    const saturday = new Date(2026, 2, 14);
    const nextOperating = store.getState().getNextOperatingDate(saturday);
    expect(nextOperating.getDay()).toBe(1); // Lunedì
  });

  it("deve ritornare la stessa data se già operativa", () => {
    const store = createBusinessSettingsStore();
    store.getState().setSettings(mockSettings);

    // Lunedì 9 marzo 2026 è già operativo
    const monday = new Date(2026, 2, 9);
    const result = store.getState().getNextOperatingDate(monday);
    expect(result.getDate()).toBe(9);
  });

  it("deve gestire operatingDays con tutti i giorni attivi", () => {
    const store = createBusinessSettingsStore();
    store.getState().setSettings({
      ...mockSettings,
      operatingDays: [true, true, true, true, true, true, true],
    });

    const saturday = new Date(2026, 2, 14);
    expect(store.getState().isOpen(saturday)).toBe(true);

    const sunday = new Date(2026, 2, 15);
    expect(store.getState().isOpen(sunday)).toBe(true);
  });
});
