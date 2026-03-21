import dayjs from "dayjs";

// Mappa giorno JavaScript (0=domenica) a indice array operatingDays (0=lunedì)
const weekDayMap: Record<number, number> = {
  0: 6, // Domenica → Indice 6
  1: 0, // Lunedì → Indice 0
  2: 1, // Martedì → Indice 1
  3: 2, // Mercoledì → Indice 2
  4: 3, // Giovedì → Indice 3
  5: 4, // Venerdì → Indice 4
  6: 5, // Sabato → Indice 5
};

interface BusinessSettingsStoreState {
  settings: BusinessSettings | null;
  setSettings: (settings: BusinessSettings) => void;
  settingsLoaded: boolean;
  setSettingsLoaded: (loaded: boolean) => void;
  settingsError: string | null;
  setSettingsError: (error: string | null) => void;
  periodi: PeriodoProgrammazione[];
  setPeriodi: (periodi: PeriodoProgrammazione[]) => void;
  giorniNonLavorativi: GiornoNonLavorativo[];
  setGiorniNonLavorativi: (giorni: GiornoNonLavorativo[]) => void;
  isOpen: (date: Date) => boolean;
  isOpenNow: () => boolean;
  getNextOperatingDate: (from?: Date) => Date;
  getOpeningTime: () => string | null;
  getClosingTime: () => string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function businessSettingsStore(set: any, get: () => Store): BusinessSettingsStoreState {
  return {
    settings: null,
    settingsLoaded: false,
    settingsError: null,
    periodi: [],
    giorniNonLavorativi: [],

    setSettings: (settings: BusinessSettings) => {
      set((state: Store) => ({ ...state, settings }));
    },

    setSettingsLoaded: (loaded: boolean) => {
      set((state: Store) => ({ ...state, settingsLoaded: loaded }));
    },

    setSettingsError: (error: string | null) => {
      set((state: Store) => ({ ...state, settingsError: error }));
    },

    setPeriodi: (periodi: PeriodoProgrammazione[]) => {
      set((state: Store) => ({ ...state, periodi }));
    },

    setGiorniNonLavorativi: (giorniNonLavorativi: GiornoNonLavorativo[]) => {
      set((state: Store) => ({ ...state, giorniNonLavorativi }));
    },

    isOpen: (date: Date): boolean => {
      const state = get();
      const settings = state.settings as BusinessSettings | null;
      if (!settings) return false; // Se no settings, assume chiuso

      const dayOfWeek = date.getDay(); // 0=domenica, 6=sabato
      const operatingDayIndex = weekDayMap[dayOfWeek];

      let operativo = false;

      // Se ci sono periodi di programmazione, cerca quello che copre la data
      if (state.periodi.length > 0) {
        const dateStr = dayjs(date).format("YYYY-MM-DD");
        const periodo = state.periodi.find(
          (p) => p.dataInizio <= dateStr && (p.dataFine === null || p.dataFine >= dateStr),
        );
        if (!periodo) return false; // Nessun periodo copre la data
        operativo = periodo.giorniOperativi[operatingDayIndex] === true;
      } else {
        // Fallback: usa operatingDays globale se non ci sono periodi
        operativo = settings.operatingDays[operatingDayIndex] === true;
      }

      if (!operativo) return false;

      // Controlla se il giorno è un giorno non lavorativo
      const giorniNonLavorativi = (state as Store).giorniNonLavorativi ?? [];
      if (giorniNonLavorativi.length > 0) {
        const dateStr = dayjs(date).format("YYYY-MM-DD");
        const mm = dateStr.substring(5); // "MM-DD"
        const isNonLavorativo = giorniNonLavorativi.some((g) => {
          if (g.ricorrente) {
            // Per ricorrenti: confronta solo mese e giorno
            return g.data.substring(5) === mm;
          }
          // Per non ricorrenti: confronta la data completa
          return g.data === dateStr;
        });
        if (isNonLavorativo) return false;
      }

      return true;
    },

    isOpenNow: (): boolean => {
      const state = get();
      const settings = state.settings as BusinessSettings | null;
      if (!settings) return false;

      const now = dayjs();

      // Riusa isOpen() che gestisce già periodi, operatingDays e giorni non lavorativi
      if (!state.isOpen(now.toDate())) return false;

      // Determina orari di apertura/chiusura dal periodo attivo o dai settings globali
      let openingTime = settings.openingTime;
      let closingTime = settings.closingTime;

      if (state.periodi.length > 0) {
        const dateStr = now.format("YYYY-MM-DD");
        const periodo = state.periodi.find(
          (p) => p.dataInizio <= dateStr && (p.dataFine === null || p.dataFine >= dateStr),
        );
        if (periodo) {
          openingTime = periodo.orarioApertura ?? openingTime;
          closingTime = periodo.orarioChiusura ?? closingTime;
        }
      }

      const currentTime = now.format("HH:mm");
      return currentTime >= openingTime && currentTime <= closingTime;
    },

    getNextOperatingDate: (from?: Date): Date => {
      const state = get();
      const date = new Date(from ?? new Date());
      // Se il giorno è già operativo, ritornalo
      if (state.isOpen(date)) return date;
      // Cerca il prossimo giorno operativo (max 7 iterazioni)
      for (let i = 1; i <= 7; i++) {
        date.setDate(date.getDate() + 1);
        if (state.isOpen(date)) return date;
      }
      return from ?? new Date(); // fallback
    },

    getOpeningTime: (): string | null => {
      const state = get();
      const settings = state.settings as BusinessSettings | null;
      return settings?.openingTime ?? null;
    },

    getClosingTime: (): string | null => {
      const state = get();
      const settings = state.settings as BusinessSettings | null;
      return settings?.closingTime ?? null;
    },
  };
}

export default businessSettingsStore;
