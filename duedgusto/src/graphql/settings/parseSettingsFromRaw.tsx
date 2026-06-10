/** Shape raw di businessSettings come arriva da GraphQL (GET_BUSINESS_SETTINGS / updateBusinessSettings). */
export interface RawBusinessSettings {
  settingsId: number;
  businessName: string;
  openingTime?: string | null;
  closingTime?: string | null;
  operatingDays: string | boolean[];
  timezone: string;
  currency: string;
  vatRate: number;
  updatedAt?: string;
  createdAt?: string;
}

/** Shape raw di un periodo di programmazione come arriva da GraphQL. */
export interface RawPeriodoProgrammazione {
  periodoId: number;
  dataInizio: string;
  dataFine: string | null;
  giorniOperativi: string | boolean[];
  orarioApertura?: string | null;
  orarioChiusura?: string | null;
  settingsId?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Shape raw del campo Query.settings (GET_BUSINESS_SETTINGS). */
export interface RawSettingsData {
  businessSettings?: RawBusinessSettings | null;
  periodiProgrammazione?: RawPeriodoProgrammazione[] | null;
  giorniNonLavorativi?: GiornoNonLavorativo[] | null;
}

function parseOperatingDays(raw: string | boolean[]): boolean[] {
  if (typeof raw === "string") return JSON.parse(raw) as boolean[];
  return raw;
}

/**
 * Parsa i dati raw dalla query GraphQL GET_BUSINESS_SETTINGS,
 * convertendo stringhe JSON in array e troncando gli orari.
 *
 * Usato da: useSyncSettingsToStore (unico writer dello store),
 * useGetBusinessSettings, SettingsDetails (re-init form post-mutation)
 * per garantire che i dati nello Zustand store siano sempre
 * nel formato corretto (array, non stringhe JSON).
 */
export function parseSettingsFromRaw(rawData: RawSettingsData | null | undefined): {
  settings: BusinessSettings | null;
  periodi: PeriodoProgrammazione[];
  giorniNonLavorativi: GiornoNonLavorativo[];
} {
  const rawSettings = rawData?.businessSettings;
  const settings: BusinessSettings | null = rawSettings
    ? {
        ...rawSettings,
        openingTime: rawSettings.openingTime?.substring(0, 5) || "",
        closingTime: rawSettings.closingTime?.substring(0, 5) || "",
        operatingDays: parseOperatingDays(rawSettings.operatingDays),
      }
    : null;

  const rawPeriodi = rawData?.periodiProgrammazione;
  const periodi: PeriodoProgrammazione[] = Array.isArray(rawPeriodi)
    ? rawPeriodi.map(
        (p) =>
          ({
            ...p,
            giorniOperativi: parseOperatingDays(p.giorniOperativi),
            orarioApertura: p.orarioApertura ?? "09:00",
            orarioChiusura: p.orarioChiusura ?? "18:00",
          }) as PeriodoProgrammazione
      )
    : [];

  const rawGiorni = rawData?.giorniNonLavorativi;
  const giorniNonLavorativi: GiornoNonLavorativo[] = Array.isArray(rawGiorni) ? rawGiorni : [];

  return { settings, periodi, giorniNonLavorativi };
}
