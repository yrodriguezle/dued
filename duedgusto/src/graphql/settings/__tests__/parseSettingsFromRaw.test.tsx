import { describe, it, expect } from "vitest";
import { parseSettingsFromRaw } from "../parseSettingsFromRaw";

describe("parseSettingsFromRaw", () => {
  const rawSettings = {
    settingsId: 1,
    businessName: "DuedGusto",
    openingTime: "09:00:00",
    closingTime: "18:00:00",
    operatingDays: "[true,true,true,true,true,false,false]",
    timezone: "Europe/Rome",
    currency: "EUR",
    vatRate: 0.22,
  };

  const rawPeriodi = [
    {
      periodoId: 1,
      dataInizio: "2026-01-01",
      dataFine: null,
      giorniOperativi: "[true,true,true,true,true,false,false]",
      orarioApertura: "09:00",
      orarioChiusura: "18:00",
      settingsId: 1,
    },
  ];

  const rawGiorniNonLavorativi = [
    {
      giornoId: 1,
      data: "2026-12-25",
      descrizione: "Natale",
      codiceMotivo: "FESTIVITA_NAZIONALE",
      ricorrente: true,
      settingsId: 1,
      creatoIl: "2026-03-21",
      aggiornatoIl: "2026-03-21",
    },
  ];

  it("parsa operatingDays da stringa JSON ad array boolean", () => {
    const result = parseSettingsFromRaw({
      businessSettings: rawSettings,
      periodiProgrammazione: rawPeriodi,
      giorniNonLavorativi: rawGiorniNonLavorativi,
    });

    expect(result.settings!.operatingDays).toEqual([true, true, true, true, true, false, false]);
    expect(Array.isArray(result.settings!.operatingDays)).toBe(true);
  });

  it("tronca openingTime e closingTime a HH:mm", () => {
    const result = parseSettingsFromRaw({
      businessSettings: rawSettings,
      periodiProgrammazione: rawPeriodi,
      giorniNonLavorativi: rawGiorniNonLavorativi,
    });

    expect(result.settings!.openingTime).toBe("09:00");
    expect(result.settings!.closingTime).toBe("18:00");
  });

  it("parsa giorniOperativi dei periodi da stringa JSON ad array boolean", () => {
    const result = parseSettingsFromRaw({
      businessSettings: rawSettings,
      periodiProgrammazione: rawPeriodi,
      giorniNonLavorativi: rawGiorniNonLavorativi,
    });

    expect(result.periodi[0].giorniOperativi).toEqual([true, true, true, true, true, false, false]);
    expect(Array.isArray(result.periodi[0].giorniOperativi)).toBe(true);
  });

  it("gestisce operatingDays già come array (non serve parsing)", () => {
    const result = parseSettingsFromRaw({
      businessSettings: {
        ...rawSettings,
        operatingDays: [true, true, true, true, true, false, false],
      },
      periodiProgrammazione: [
        {
          ...rawPeriodi[0],
          giorniOperativi: [true, true, true, true, true, false, false],
        },
      ],
      giorniNonLavorativi: rawGiorniNonLavorativi,
    });

    expect(result.settings!.operatingDays).toEqual([true, true, true, true, true, false, false]);
    expect(result.periodi[0].giorniOperativi).toEqual([true, true, true, true, true, false, false]);
  });

  it("ritorna settings null se businessSettings è null", () => {
    const result = parseSettingsFromRaw({
      businessSettings: null,
      periodiProgrammazione: rawPeriodi,
      giorniNonLavorativi: rawGiorniNonLavorativi,
    });

    expect(result.settings).toBeNull();
  });

  it("ritorna array vuoti se periodi o giorni non lavorativi sono null", () => {
    const result = parseSettingsFromRaw({
      businessSettings: rawSettings,
      periodiProgrammazione: null,
      giorniNonLavorativi: null,
    });

    expect(result.periodi).toEqual([]);
    expect(result.giorniNonLavorativi).toEqual([]);
  });

  it("passa i giorni non lavorativi così come sono", () => {
    const result = parseSettingsFromRaw({
      businessSettings: rawSettings,
      periodiProgrammazione: rawPeriodi,
      giorniNonLavorativi: rawGiorniNonLavorativi,
    });

    expect(result.giorniNonLavorativi).toEqual(rawGiorniNonLavorativi);
    expect(result.giorniNonLavorativi[0].ricorrente).toBe(true);
    expect(result.giorniNonLavorativi[0].data).toBe("2026-12-25");
  });
});
