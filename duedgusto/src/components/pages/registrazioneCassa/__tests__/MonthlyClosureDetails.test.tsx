import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock delle dipendenze (pattern ProfilePage.test.tsx: vi.mock dei moduli hook, NON MockedProvider) ──

vi.mock("../../../../store/useStore", () => {
  const mockStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  });
  return { default: mockStore };
});

vi.mock("../../../../graphql/chiusureMensili/queries", () => ({
  useQueryChiusuraMensile: vi.fn(),
  useQueryValidaCompletezzaRegistri: vi.fn(),
}));

// Le 7 mutation via mock useMutation (pattern ProfilePage)
const mockMutate = vi.fn(async () => ({ data: undefined }));
vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: vi.fn(() => [mockMutate, { loading: false, data: undefined, error: undefined }]),
  };
});

// Stub griglie AG Grid e report
vi.mock("../MonthlyExpensesDataGrid", () => ({
  default: () => <div data-testid="monthly-expenses-data-grid" />,
}));
vi.mock("../MonthlyClosureReport", () => ({
  default: () => <div data-testid="monthly-closure-report" />,
}));

// ── Import dopo i mock ─────────────────────────────────────────────────

import useStore from "../../../../store/useStore";
import { useQueryChiusuraMensile, useQueryValidaCompletezzaRegistri } from "../../../../graphql/chiusureMensili/queries";
import MonthlyClosureDetails from "../MonthlyClosureDetails";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import { DataRouterTestWrapper } from "../../../../test/helpers/dataRouterTestWrapper";

const mockUseStore = vi.mocked(useStore);
const mockUseQueryChiusuraMensile = vi.mocked(useQueryChiusuraMensile);
const mockUseQueryValidaCompletezzaRegistri = vi.mocked(useQueryValidaCompletezzaRegistri);

// ── Dati di test ───────────────────────────────────────────────────────

const mockChiusuraBozza = {
  chiusuraId: 5,
  anno: 2026,
  mese: 5,
  stato: "BOZZA",
  giorniEsclusi: null,
  note: null,
  chiusaDaUtente: null,
  chiusaIl: null,
  registriInclusi: [],
  speseLibere: [],
  pagamentiInclusi: [],
  ricavoNettoCalcolato: 1500.5,
  totaleContantiCalcolato: 800,
  totaleElettroniciCalcolato: 600,
  totaleFattureCalcolato: 100.5,
  speseAggiuntiveCalcolate: 50,
  totaleLordoCalcolato: 1500.5,
  totaleImponibileCalcolato: 1364.09,
  totaleIvaCalcolato: 136.41,
  totaleDifferenzeCassaCalcolato: 0,
} as unknown as ChiusuraMensile;

const mockRefetch = vi.fn();
const mockSetTitle = vi.fn();

// ── Helper ─────────────────────────────────────────────────────────────

function setupStore() {
  mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
    const state = {
      setConfirmValues: vi.fn(),
      setFormDirty: vi.fn(),
    } as unknown as Store;
    return selector(state);
  });
}

function setupQueries(chiusura: ChiusuraMensile | null = mockChiusuraBozza, giorniMancanti: string[] = []) {
  mockUseQueryChiusuraMensile.mockReturnValue({
    chiusuraMensile: chiusura ?? undefined,
    loading: false,
    error: undefined,
    refetch: mockRefetch,
  } as never);
  mockUseQueryValidaCompletezzaRegistri.mockReturnValue({
    giorniMancanti,
    loading: false,
    error: undefined,
    refetch: mockRefetch,
  } as never);
}

function renderMonthlyClosureDetails(id = 5) {
  return render(
    <PageTitleContext.Provider value={{ title: "", setTitle: mockSetTitle }}>
      <DataRouterTestWrapper
        path="/gestionale/cassa/chiusura-mensile/:id"
        initialEntries={[`/gestionale/cassa/chiusura-mensile/${id}`]}
      >
        <MonthlyClosureDetails />
      </DataRouterTestWrapper>
    </PageTitleContext.Provider>
  );
}

// ── Test ────────────────────────────────────────────────────────────────

describe("MonthlyClosureDetails (smoke)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
    setupQueries();
  });

  it("monta senza errori in modalità :id con chiusura BOZZA e mostra le sezioni chiave", () => {
    renderMonthlyClosureDetails(5);

    // Metriche del riepilogo
    expect(screen.getByText("Ricavo Netto")).toBeInTheDocument();
    expect(screen.getByText("Totale Vendite")).toBeInTheDocument();
    expect(screen.getByText("Contanti")).toBeInTheDocument();
    expect(screen.getByText("Elettronici")).toBeInTheDocument();
    expect(screen.getByText("€ 1500.50")).toBeInTheDocument();

    // Griglia spese (stub) e report (stub)
    expect(screen.getByTestId("monthly-expenses-data-grid")).toBeInTheDocument();
    expect(screen.getByTestId("monthly-closure-report")).toBeInTheDocument();
  });

  it("imposta il titolo 'Chiusura Mensile - …'", () => {
    renderMonthlyClosureDetails(5);
    expect(mockSetTitle).toHaveBeenCalledWith(expect.stringContaining("Chiusura Mensile -"));
    expect(mockSetTitle).toHaveBeenCalledWith(expect.stringContaining("2026"));
  });

  it("mostra le azioni di toolbar per la bozza (Salva, Chiudi Mese, Elimina, Indietro)", () => {
    renderMonthlyClosureDetails(5);

    expect(screen.getByText("Indietro")).toBeInTheDocument();
    expect(screen.getByText("Salva")).toBeInTheDocument();
    expect(screen.getByText("Chiudi Mese")).toBeInTheDocument();
    expect(screen.getByText("Elimina")).toBeInTheDocument();
  });

  it("mostra l'alert quando la chiusura non viene trovata", () => {
    setupQueries(null);
    renderMonthlyClosureDetails(99);
    expect(screen.getByText("Chiusura non trovata.")).toBeInTheDocument();
  });
});
