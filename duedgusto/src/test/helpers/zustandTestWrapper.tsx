/**
 * Zustand Test Wrapper
 *
 * Fornisce utility per creare store Zustand isolati nei test,
 * evitando stato condiviso tra test diversi.
 */
import { create } from "zustand";
import userStore from "../../store/userStore";
import inProgressStore from "../../store/inProgressStore";
import themeStore from "../../store/themeStore";
import confirmDialogStore from "../../store/confirmDialogStore";
import serverStatusStore from "../../store/serverStatusStore";
import businessSettingsStore from "../../store/businessSettingsStore";

/**
 * Crea un'istanza isolata dello store per i test.
 * Ogni chiamata crea uno store completamente nuovo, evitando
 * contaminazione tra test.
 */
export const createTestStore = (overrides?: Partial<Store>) => {
  const store = create<Store>((set, get) => ({
    ...userStore(set),
    ...inProgressStore(set),
    ...themeStore(set),
    ...confirmDialogStore(set),
    ...serverStatusStore(set),
    ...businessSettingsStore(set, get),
    ...overrides,
  }));
  return store;
};

/**
 * Resetta lo stato dello store principale importando e ricreando.
 * Da usare nel beforeEach per garantire isolamento tra test.
 *
 * NOTA: Per il massimo isolamento, preferire createTestStore()
 * che crea un'istanza completamente nuova.
 */
export const resetStoreState = () => {
  // Resetta lo store tramite vi.resetModules() nel test
  // Questa funzione fornisce un reset manuale se necessario
  const store = createTestStore();
  return store;
};
