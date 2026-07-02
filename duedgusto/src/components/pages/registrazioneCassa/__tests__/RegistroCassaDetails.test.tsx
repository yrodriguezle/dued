import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock delle dipendenze (pattern ProfilePage.test.tsx: vi.mock dei moduli hook, NON MockedProvider) ──

const mockReceiveUtente = vi.fn();
vi.mock("../../../../store/useStore", () => {
  const mockStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  });
  return { default: mockStore };
});

vi.mock("../../../../graphql/registroCassa/useQueryDenominations", () => ({
  default: vi.fn(),
}));

vi.mock("../../../../graphql/registroCassa/useQueryRegistroCassa", () => ({
  default: vi.fn(),
}));

const mockSubmitRegistroCassa = vi.fn();
vi.mock("../../../../graphql/registroCassa/useSubmitRegistroCassa", () => ({
  default: vi.fn(() => ({
    submitRegistroCassa: mockSubmitRegistroCassa,
    data: undefined,
    error: undefined,
    loading: false,
  })),
}));

const mockCloseCashRegister = vi.fn();
vi.mock("../../../../graphql/registroCassa/useCloseCashRegister", () => ({
  default: vi.fn(() => ({
    chiudiRegistroCassa: mockCloseCashRegister,
    closeCashRegister: mockCloseCashRegister,
    data: undefined,
    error: undefined,
    loading: false,
  })),
}));

// Le 3 subscription WS: nessun evento ({ data: undefined })
vi.mock("../../../../graphql/subscriptions/useRegistroCassaSubscription", () => ({
  default: vi.fn(() => ({ data: undefined, loading: false })),
}));
vi.mock("../../../../graphql/subscriptions/useVenditaCreatedSubscription", () => ({
  default: vi.fn(() => ({ data: undefined, loading: false })),
}));
vi.mock("../../../../graphql/subscriptions/useChiusuraCassaSubscription", () => ({
  default: vi.fn(() => ({ data: undefined, loading: false })),
}));

// useApolloClient: il componente lo usa solo per "Copia dal giorno precedente"
const mockClientQuery = vi.fn(async () => ({ data: undefined }));
vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useApolloClient: vi.fn(() => ({ query: mockClientQuery })),
  };
});

// Stub AG Grid Enterprise (non gira in jsdom in modo affidabile)
vi.mock("../RegistroCassaForm", () => ({
  default: () => <div data-testid="cash-register-form-data-grid" />,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// ── Import dopo i mock ─────────────────────────────────────────────────

import useStore from "../../../../store/useStore";
import useQueryDenominations from "../../../../graphql/registroCassa/useQueryDenominations";
import useQueryRegistroCassa from "../../../../graphql/registroCassa/useQueryRegistroCassa";
import RegistroCassaDetails from "../RegistroCassaDetails";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import { DataRouterTestWrapper } from "../../../../test/helpers/dataRouterTestWrapper";

const mockUseStore = vi.mocked(useStore);
const mockUseQueryDenominations = vi.mocked(useQueryDenominations);
const mockUseQueryRegistroCassa = vi.mocked(useQueryRegistroCassa);

// ── Dati di test ───────────────────────────────────────────────────────

const mockUtente = {
  id: 1,
  nomeUtente: "mario.rossi",
  nome: "Mario",
  cognome: "Rossi",
} as Utente;

const mockDenominazioni: DenominazioneMoneta[] = [
  { __typename: "DenominazioneMoneta", id: 1, valore: 0.5, tipo: "COIN", ordineVisualizzazione: 1 },
  { __typename: "DenominazioneMoneta", id: 2, valore: 5, tipo: "BANKNOTE", ordineVisualizzazione: 2 },
];

const mockRegistroCassa = {
  id: 42,
  data: "2026-06-10T00:00:00Z",
  utenteId: 1,
  note: "Nota di test",
  stato: "DRAFT",
  conteggiApertura: [{ denominazioneMonetaId: 1, quantita: 10 }],
  conteggiChiusura: [],
  incassoContanteTracciato: 100,
  incassiElettronici: 50,
  incassiFattura: 0,
  spese: [],
  pagamentiFornitori: [],
} as unknown as RegistroCassa;

const mockRefetch = vi.fn();
const mockSetTitle = vi.fn();

// ── Helper ─────────────────────────────────────────────────────────────

function setupStore() {
  mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
    const state = {
      utente: mockUtente,
      receiveUtente: mockReceiveUtente,
      isOpen: () => true,
      getNextOperatingDate: (date: Date) => date,
      setFormDirty: vi.fn(),
      setConfirmValues: vi.fn(),
      userTheme: { mode: "light", theme: "light" },
    } as unknown as Store;
    return selector(state);
  });
}

function setupQueries(cashRegister: RegistroCassa | null = null) {
  mockUseQueryDenominations.mockReturnValue({
    denominazioni: mockDenominazioni,
    error: undefined,
    loading: false,
  } as never);
  mockUseQueryRegistroCassa.mockReturnValue({
    registroCassa: cashRegister,
    error: undefined,
    loading: false,
    refetch: mockRefetch,
  } as never);
}

function renderRegistroCassaDetails(date = "2026-06-10") {
  return render(
    <PageTitleContext.Provider value={{ title: "", setTitle: mockSetTitle }}>
      <DataRouterTestWrapper
        path="/gestionale/cassa/details/:date"
        initialEntries={[`/gestionale/cassa/details/${date}`]}
      >
        <RegistroCassaDetails />
      </DataRouterTestWrapper>
    </PageTitleContext.Provider>
  );
}

// ── Test ────────────────────────────────────────────────────────────────

describe("RegistroCassaDetails (smoke)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
    setupQueries();
  });

  it("monta senza errori sulla route con data e mostra la data formattata nella toolbar", () => {
    renderRegistroCassaDetails("2026-06-10");

    // Data formattata visibile (DD/MM/YYYY su desktop, DD/MM su mobile)
    expect(screen.getByText(/10\/06/)).toBeInTheDocument();
    // Navigazione giorni nella toolbar
    expect(screen.getByTitle("Giorno precedente")).toBeInTheDocument();
    expect(screen.getByTitle("Giorno successivo")).toBeInTheDocument();
    expect(screen.getByTitle("Vista mensile")).toBeInTheDocument();
    // Toolbar form con bottone Salva
    expect(screen.getByText("Salva")).toBeInTheDocument();
    // Griglia (stub) montata
    expect(screen.getByTestId("cash-register-form-data-grid")).toBeInTheDocument();
  });

  it("imposta il titolo della pagina", () => {
    renderRegistroCassaDetails();
    expect(mockSetTitle).toHaveBeenCalledWith("Gestione Cassa");
  });

  it("mostra il bottone Chiudi Cassa quando il registro esistente è in stato DRAFT", () => {
    setupQueries(mockRegistroCassa);
    renderRegistroCassaDetails("2026-06-10");

    expect(screen.getByText("Chiudi Cassa")).toBeInTheDocument();
    expect(screen.getByTestId("cash-register-form-data-grid")).toBeInTheDocument();
  });

  it("mostra il loader quando le query sono in caricamento", () => {
    mockUseQueryRegistroCassa.mockReturnValue({
      registroCassa: null,
      error: undefined,
      loading: true,
      refetch: mockRefetch,
    } as never);

    renderRegistroCassaDetails();
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
  });
});
