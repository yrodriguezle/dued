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
  isOpen: (date: Date) => boolean;
  isOpenNow: () => boolean;
  getOpeningTime: () => string | null;
  getClosingTime: () => string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function businessSettingsStore(set: any, get: () => Store): BusinessSettingsStoreState {
  return {
    settings: null,

    setSettings: (settings: BusinessSettings) => {
      set((state: Store) => ({ ...state, settings }));
    },

    isOpen: (date: Date): boolean => {
      const state = get();
      const settings = state.settings as BusinessSettings | null;
      if (!settings) return true; // Se no settings, assume aperto

      const dayOfWeek = date.getDay(); // 0=domenica, 6=sabato
      const operatingDayIndex = weekDayMap[dayOfWeek];

      return settings.operatingDays[operatingDayIndex] === true;
    },

    isOpenNow: (): boolean => {
      const state = get();
      const settings = state.settings as BusinessSettings | null;
      if (!settings) return true;

      const now = dayjs();
      const dayOfWeek = now.day();
      const operatingDayIndex = weekDayMap[dayOfWeek];

      if (settings.operatingDays[operatingDayIndex] === false) {
        return false; // Chiuso questo giorno
      }

      const currentTime = now.format("HH:mm");
      return currentTime >= settings.openingTime && currentTime <= settings.closingTime;
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
