type BusinessSettings = {
  settingsId: number;
  businessName: string;
  openingTime: string; // "09:00" (HH:mm)
  closingTime: string; // "18:00" (HH:mm)
  operatingDays: boolean[]; // [mon, tue, wed, thu, fri, sat, sun]
  timezone: string; // "Europe/Rome"
  currency: string; // "EUR"
  vatRate: number; // 0.22 (22%)
  updatedAt?: string;
  createdAt?: string;
};

type BusinessSettingsInput = {
  businessName: string;
  openingTime: string;
  closingTime: string;
  operatingDays: boolean[];
  timezone: string;
  currency: string;
  vatRate: number;
};

type PeriodoProgrammazione = {
  periodoId: number;
  dataInizio: string; // "YYYY-MM-DD"
  dataFine: string | null; // "YYYY-MM-DD" o null (periodo attivo)
  giorniOperativi: boolean[];
  orarioApertura: string; // "HH:mm"
  orarioChiusura: string; // "HH:mm"
  settingsId: number;
  creatoIl?: string;
  aggiornatoIl?: string;
};

type GiornoNonLavorativo = {
  giornoId: number;
  data: string; // yyyy-MM-dd
  descrizione: string;
  codiceMotivo: string; // FESTIVITA_NAZIONALE | CHIUSURA_STRAORDINARIA | FERIE
  ricorrente: boolean;
  settingsId: number;
  creatoIl: string;
  aggiornatoIl: string;
};

type GiornoNonLavorativoInput = {
  giornoId?: number;
  data: string;
  descrizione: string;
  codiceMotivo: string;
  ricorrente?: boolean;
};
