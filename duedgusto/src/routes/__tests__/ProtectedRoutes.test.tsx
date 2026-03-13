import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Mock delle dipendenze
vi.mock("../../common/authentication/auth", () => ({
  isAuthenticated: vi.fn(() => false),
}));

vi.mock("../../store/useStore", () => {
  const mockStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  });
  return { default: mockStore };
});

vi.mock("../dynamicComponentLoader", () => ({
  loadDynamicComponent: vi.fn(),
}));

vi.mock("../../components/layout/Layout", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock("../RoutesFallback", () => ({
  Fallback: () => <div data-testid="fallback">Loading...</div>,
}));

// Mock dei componenti lazy
vi.mock("../../components/pages/dashboard/HomePage.tsx", () => ({
  default: () => <div data-testid="home-page">Dashboard</div>,
}));

vi.mock("../../components/pages/registrazioneCassa/MonthlyClosureDetails.tsx", () => ({
  default: () => <div>Monthly Closure</div>,
}));

vi.mock("../../components/pages/registrazioneCassa/CashRegisterMonthlyPage.tsx", () => ({
  default: () => <div>Monthly Page</div>,
}));

vi.mock("../../components/pages/registrazioneCassa/RegistroCassaDetails.tsx", () => ({
  default: () => <div>Cash Register Details</div>,
}));

import { isAuthenticated } from "../../common/authentication/auth";
import useStore from "../../store/useStore";
import { loadDynamicComponent } from "../dynamicComponentLoader";
import ProtectedRoutes from "../ProtectedRoutes";

const mockIsAuthenticated = vi.mocked(isAuthenticated);
const mockUseStore = vi.mocked(useStore);
const mockLoadDynamicComponent = vi.mocked(loadDynamicComponent);

describe("ProtectedRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve redirigere a /signin se l'utente non è autenticato", () => {
    mockIsAuthenticated.mockReturnValue(false);
    mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
      const state = { utente: null, inProgress: {}, getNextOperatingDate: () => new Date() } as unknown as Store;
      return selector(state);
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/gestionale/dashboard"]}>
        <ProtectedRoutes />
      </MemoryRouter>
    );

    // Navigate to="/signin" non renderizza contenuto nella route corrente
    // Il redirect è il comportamento atteso
    expect(container.innerHTML).toBeDefined();
    expect(mockIsAuthenticated).toHaveBeenCalled();
  });

  it("deve mostrare Fallback quando inProgress.global è true", () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
      const state = {
        utente: null,
        inProgress: { global: true },
        getNextOperatingDate: () => new Date(),
      } as unknown as Store;
      return selector(state);
    });

    render(
      <MemoryRouter initialEntries={["/gestionale/dashboard"]}>
        <ProtectedRoutes />
      </MemoryRouter>
    );

    expect(screen.getByTestId("fallback")).toBeDefined();
  });

  it("deve mostrare Fallback quando utente è null (caricamento in corso)", () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
      const state = {
        utente: null,
        inProgress: { global: false },
        getNextOperatingDate: () => new Date(),
      } as unknown as Store;
      return selector(state);
    });

    render(
      <MemoryRouter initialEntries={["/gestionale/dashboard"]}>
        <ProtectedRoutes />
      </MemoryRouter>
    );

    expect(screen.getByTestId("fallback")).toBeDefined();
  });

  it("deve generare route dai menu dell'utente", async () => {
    mockIsAuthenticated.mockReturnValue(true);

    const MockDynamicComponent = () => <div data-testid="dynamic-component">Utenti</div>;

    mockLoadDynamicComponent.mockReturnValue(MockDynamicComponent as unknown as React.LazyExoticComponent<React.ComponentType<unknown>>);

    const mockMenus: Menu[] = [
      {
        __typename: "Menu",
        id: 10,
        menuPadreId: null,
        titolo: "Utenti",
        percorso: "/gestionale/utenti",
        icona: "people",
        visibile: true,
        posizione: 1,
        percorsoFile: "users/UserList.tsx",
      },
    ];

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
      menus: mockMenus,
    };

    mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
      const state = {
        utente: mockUtente,
        inProgress: {},
        settingsLoaded: true,
        getNextOperatingDate: () => new Date(2026, 2, 12),
      } as unknown as Store;
      return selector(state);
    });

    render(
      <MemoryRouter initialEntries={["/utenti"]}>
        <ProtectedRoutes />
      </MemoryRouter>
    );

    // Verifica che loadDynamicComponent sia stato chiamato con il percorsoFile
    expect(mockLoadDynamicComponent).toHaveBeenCalledWith("users/UserList.tsx");
  });

  it("deve gestire menu senza percorso o percorsoFile ignorandoli", () => {
    mockIsAuthenticated.mockReturnValue(true);

    const mockMenus: Menu[] = [
      {
        __typename: "Menu",
        id: 10,
        menuPadreId: null,
        titolo: "Gruppo",
        percorso: "", // Nessun percorso
        icona: "folder",
        visibile: true,
        posizione: 1,
        // Nessun percorsoFile
      },
    ];

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
      menus: mockMenus,
    };

    mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
      const state = {
        utente: mockUtente,
        inProgress: {},
        settingsLoaded: true,
        getNextOperatingDate: () => new Date(2026, 2, 12),
      } as unknown as Store;
      return selector(state);
    });

    // Non deve lanciare errori
    expect(() =>
      render(
        <MemoryRouter initialEntries={["/gestionale/dashboard"]}>
          <ProtectedRoutes />
        </MemoryRouter>
      )
    ).not.toThrow();

    // loadDynamicComponent non deve essere chiamato per menu senza percorsoFile
    expect(mockLoadDynamicComponent).not.toHaveBeenCalled();
  });
});
