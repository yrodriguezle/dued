// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOperatingDays(raw: any): boolean[] {
  if (typeof raw === "string") return JSON.parse(raw);
  return raw;
}

/**
 * Parsa i dati raw dalla query GraphQL GET_BUSINESS_SETTINGS,
 * convertendo stringhe JSON in array e troncando gli orari.
 *
 * Usato da: useSettingsSync, useBootstrap, SettingsDetails
 * per garantire che i dati nello Zustand store siano sempre
 * nel formato corretto (array, non stringhe JSON).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSettingsFromRaw(rawData: any): {
  settings: BusinessSettings | null;
  periodi: PeriodoProgrammazione[];
  giorniNonLavorativi: GiornoNonLavorativo[];
} {
  const rawSettings = rawData?.businessSettings;
  const settings = rawSettings
    ? ({
        ...rawSettings,
        openingTime: rawSettings.openingTime?.substring(0, 5) || "",
        closingTime: rawSettings.closingTime?.substring(0, 5) || "",
        operatingDays: parseOperatingDays(rawSettings.operatingDays),
      } as BusinessSettings)
    : null;

  const rawPeriodi = rawData?.periodiProgrammazione;
  const periodi: PeriodoProgrammazione[] = Array.isArray(rawPeriodi)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawPeriodi.map((p: any) => ({
        ...p,
        giorniOperativi: parseOperatingDays(p.giorniOperativi),
        orarioApertura: p.orarioApertura ?? "09:00",
        orarioChiusura: p.orarioChiusura ?? "18:00",
      }))
    : [];

  const rawGiorni = rawData?.giorniNonLavorativi;
  const giorniNonLavorativi: GiornoNonLavorativo[] = Array.isArray(rawGiorni) ? rawGiorni : [];

  return { settings, periodi, giorniNonLavorativi };
}
