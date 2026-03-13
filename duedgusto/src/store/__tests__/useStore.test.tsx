import useStore from "../useStore";

// Mock del modulo theme
vi.mock("../../components/theme/theme", () => ({
  getDefaultTheme: vi.fn(() => "light"),
  getLastUserThemeMode: vi.fn(() => "default"),
  setLastUserThemeMode: vi.fn(),
}));

describe("useStore (root store)", () => {
  beforeEach(() => {
    // Prepara il DOM per themeStore
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    // Reset store allo stato iniziale
    useStore.setState({
      utente: null,
      inProgress: {},
      serverStatus: "ONLINE",
      settings: null,
      confirmDialog: {
        open: false,
        title: "",
        content: "",
        acceptLabel: "Ok",
        cancelLabel: "",
        onAccept: () => Promise.resolve(true),
      },
    });
  });

  afterEach(() => {
    const root = document.getElementById("root");
    if (root) root.remove();
  });

  it("deve comporre tutti i sub-store", () => {
    const state = useStore.getState();

    // userStore
    expect(state).toHaveProperty("utente");
    expect(state).toHaveProperty("receiveUtente");

    // inProgressStore
    expect(state).toHaveProperty("inProgress");
    expect(state).toHaveProperty("onInProgress");
    expect(state).toHaveProperty("offInProgress");

    // themeStore
    expect(state).toHaveProperty("userTheme");
    expect(state).toHaveProperty("changeTheme");

    // confirmDialogStore
    expect(state).toHaveProperty("confirmDialog");
    expect(state).toHaveProperty("setConfirmValues");

    // serverStatusStore
    expect(state).toHaveProperty("serverStatus");
    expect(state).toHaveProperty("receiveServerStatus");

    // businessSettingsStore
    expect(state).toHaveProperty("settings");
    expect(state).toHaveProperty("setSettings");
    expect(state).toHaveProperty("isOpen");
    expect(state).toHaveProperty("isOpenNow");
    expect(state).toHaveProperty("getNextOperatingDate");
    expect(state).toHaveProperty("getOpeningTime");
    expect(state).toHaveProperty("getClosingTime");
  });

  it("deve permettere di accedere e modificare le slice utente dallo store root", () => {
    expect(useStore.getState().utente).toBeNull();

    const mockUtente: Utente = {
      __typename: "Utente",
      id: 1,
      nomeUtente: "admin",
      nome: "Mario",
      cognome: "Rossi",
      descrizione: "Admin",
      disabilitato: false,
      ruoloId: 1,
      ruolo: { __typename: "Ruolo", id: 1, nome: "Admin", descrizione: "Admin" } as Ruolo,
      menus: [],
    };

    useStore.getState().receiveUtente(mockUtente);
    expect(useStore.getState().utente?.nomeUtente).toBe("admin");
  });

  it("deve permettere di usare inProgress dallo store root", () => {
    expect(useStore.getState().inProgress).toEqual({});

    useStore.getState().onInProgress("test");
    expect(useStore.getState().inProgress.test).toBe(true);

    useStore.getState().offInProgress("test");
    expect(useStore.getState().inProgress.test).toBe(false);
  });

  it("deve permettere di usare serverStatus dallo store root", () => {
    expect(useStore.getState().serverStatus).toBe("ONLINE");

    useStore.getState().receiveServerStatus("OFFLINE");
    expect(useStore.getState().serverStatus).toBe("OFFLINE");
  });

  it("deve permettere di usare businessSettings dallo store root", () => {
    expect(useStore.getState().settings).toBeNull();

    const settings: BusinessSettings = {
      settingsId: 1,
      businessName: "DuedGusto",
      openingTime: "09:00",
      closingTime: "18:00",
      operatingDays: [true, true, true, true, true, false, false],
      timezone: "Europe/Rome",
      currency: "EUR",
      vatRate: 0.22,
    };

    useStore.getState().setSettings(settings);
    expect(useStore.getState().settings?.businessName).toBe("DuedGusto");
    expect(useStore.getState().getOpeningTime()).toBe("09:00");
  });

  it("deve avere tutte le azioni come funzioni", () => {
    const state = useStore.getState();

    expect(typeof state.receiveUtente).toBe("function");
    expect(typeof state.onInProgress).toBe("function");
    expect(typeof state.offInProgress).toBe("function");
    expect(typeof state.changeTheme).toBe("function");
    expect(typeof state.setConfirmValues).toBe("function");
    expect(typeof state.receiveServerStatus).toBe("function");
    expect(typeof state.setSettings).toBe("function");
    expect(typeof state.isOpen).toBe("function");
    expect(typeof state.isOpenNow).toBe("function");
    expect(typeof state.getNextOperatingDate).toBe("function");
    expect(typeof state.getOpeningTime).toBe("function");
    expect(typeof state.getClosingTime).toBe("function");
  });
});
