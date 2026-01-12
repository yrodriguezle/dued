type BusinessSettings = {
  settingsId: number;
  businessName: string;
  openingTime: string;      // "09:00" (HH:mm)
  closingTime: string;      // "18:00" (HH:mm)
  operatingDays: boolean[]; // [mon, tue, wed, thu, fri, sat, sun]
  timezone: string;         // "Europe/Rome"
  currency: string;         // "EUR"
  vatRate: number;          // 0.22 (22%)
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
