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

// Le mutation via mock useMutation (pattern ProfilePage)
const mockMutate = vi.fn(async () => ({ data: undefined }));
vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: vi.fn(() => [mockMutate, { loading: false, data: undefined, error: undefined }]),
  };
});

// Il report usa @mui/x-charts (non necessario per lo smoke test dei KPI).
vi.mock("../MonthlyClosureReport", () => ({
  default: () => <div data-testid="monthly-closure-report" />,
}));

// La chiusura mensile ORA monta una griglia spese editabile (SpeseDataGrid).
// SpeseDataGrid include PagamentoFornitoreDialog che usa useLazyQuery di Apollo:
// senza ApolloProvider real-e questo esplode con InvariantError. Per lo smoke test
// dei KPI/lifecycle stubbiamo l'intera griglia con un semplice segnaposto: la
// logica interna della griglia è coperta in SpeseDataGrid.test.tsx. Il conteggio
// righe (`initialExpenses`) è esposto per verificare che la griglia riceva le
// spese appiattite dai registri inclusi.
vi.mock("../SpeseDataGrid", () => ({
  default: (props: { initialExpenses?: unknown[] }) => (
    <div
      data-testid="spese-data-grid"
      data-rows={props.initialExpenses?.length ?? 0}
    />
  ),
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

// Registro incluso a maggio 2026 con valori scelti per KPI aggregati deterministici:
// - totaleVendite 1000 → "Totale Vendite" = 1.000,00
// - contante 300 + elettronici 200 + fatture 100 → "Ricavo tracciato" = 600,00
// - movimentoCassa (chiusura 700 - apertura 0) - contante 300 = 400 → "Ricavo non tracc." = 400,00
//   (600 tracciato + 400 non tracciato = 1000 = Totale Vendite: i ricavi quadrano)
// - speseFornitori 150 → "Spese tracciate" = 150,00
// - speseGiornaliere 50 → "Spese non tracc." = 50,00
function makeRegistroIncluso(overrides: Record<string, unknown> = {}, incluso = true) {
  const registroId = (overrides.id as number) ?? 11;
  return {
    __typename: "RegistroCassaMensile",
    chiusuraId: 5,
    registroId,
    incluso,
    registro: {
      id: registroId,
      data: "2026-05-04",
      totaleVendite: 1000,
      incassoContanteTracciato: 300,
      incassiElettronici: 200,
      incassiFattura: 100,
      differenza: 0,
      stato: "CLOSED",
      totaleApertura: 0,
      totaleChiusura: 700,
      speseFornitori: 150,
      speseGiornaliere: 50,
      // Lista spese/pagamenti per la griglia editabile: NON influenza i KPI aggregati
      // (aggregaRegistriPerMese usa i campi numerici speseFornitori/speseGiornaliere).
      // Serve solo a verificare che flattenSpeseChiusura alimenti SpeseDataGrid.
      spese: [{ id: 1, registroCassaId: registroId, descrizione: "Spesa test", importo: 10, categoria: "Altro" }],
      pagamentiFornitori: [],
      ...overrides,
    },
  };
}

const mockChiusuraBozza = {
  chiusuraId: 5,
  anno: 2026,
  mese: 5,
  stato: "BOZZA",
  giorniEsclusi: null,
  note: null,
  chiusaDaUtente: null,
  chiusaIl: null,
  registriInclusi: [makeRegistroIncluso()],
  // ricavoNettoCalcolato NON deve comparire nella headline (era la vecchia strip fiscale)
  ricavoNettoCalcolato: 999,
  // Campi fiscali di pura aggregazione (presenti ma non nella headline gestionale)
  ricavoTotaleCalcolato: 1000,
  totaleContantiCalcolato: 300,
  totaleElettroniciCalcolato: 200,
  totaleFattureCalcolato: 100,
  speseTracciateRegistriCalcolate: 150,
  speseGiornaliereRegistriCalcolate: 50,
  totaleLordoCalcolato: 1000,
  totaleImponibileCalcolato: 900,
  totaleIvaCalcolato: 100,
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

  it("monta senza errori in modalità :id con chiusura BOZZA e mostra i KPI gestionali + la griglia spese", () => {
    renderMonthlyClosureDetails(5);

    // KPI gestionali: hero "Differenza" (l'etichetta esiste anche come header tabella registri) + valore hero univoco
    expect(screen.getAllByText("Differenza").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("€ 800,00")).toBeInTheDocument();
    // banda a 6
    expect(screen.getByText("Totale Vendite")).toBeInTheDocument();
    expect(screen.getByText("Totale Spese")).toBeInTheDocument();
    expect(screen.getByText("Ricavo tracciato")).toBeInTheDocument();
    expect(screen.getByText("Ricavo non tracc.")).toBeInTheDocument();
    expect(screen.getByText("Spese tracciate")).toBeInTheDocument();
    expect(screen.getByText("Spese non tracc.")).toBeInTheDocument();

    // Le tre differenze quadrano: totale (800) = tracciata (450) + non tracciata (350)
    expect(screen.getByText("€ 450,00")).toBeInTheDocument(); // Differenza tracciata
    expect(screen.getByText("€ 350,00")).toBeInTheDocument(); // Differenza non tracc.

    // La strip fiscale (Ricavo Netto) è stata sostituita: non deve più comparire
    expect(screen.queryByText("Ricavo Netto")).not.toBeInTheDocument();

    // La chiusura ORA include la griglia spese editabile (stub) + il report (stub).
    // La griglia riceve una riga appiattita dal registro incluso (1 spesa libera).
    const grid = screen.getByTestId("spese-data-grid");
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute("data-rows", "1");
    expect(screen.getByTestId("monthly-closure-report")).toBeInTheDocument();
  });

  it("adatta i KPI gestionali come pura aggregazione dei SOLI registri inclusi", () => {
    // Aggiunge un registro ESCLUSO con valori enormi: NON deve contribuire agli aggregati.
    const chiusura = {
      ...mockChiusuraBozza,
      registriInclusi: [
        makeRegistroIncluso(),
        makeRegistroIncluso({ id: 22, totaleVendite: 5000 }, false),
      ],
    } as unknown as ChiusuraMensile;
    setupQueries(chiusura);

    renderMonthlyClosureDetails(5);

    // Hero = differenza aggregata dei registri inclusi (800). Il campo fiscale
    // ricavoNettoCalcolato (999) NON deve mai comparire nella headline.
    expect(screen.getByText("€ 800,00")).toBeInTheDocument();
    expect(screen.queryByText("€ 999,00")).not.toBeInTheDocument();

    // Banda: aggregati calcolati SOLO sui registri inclusi (il registro escluso da 5000 è ignorato)
    expect(screen.getByText("1.000,00")).toBeInTheDocument(); // Totale Vendite (non 6.000,00)
    expect(screen.queryByText("6.000,00")).not.toBeInTheDocument();
    expect(screen.getByText("600,00")).toBeInTheDocument(); // Ricavo tracciato
    expect(screen.getByText("150,00")).toBeInTheDocument(); // Spese tracciate
    expect(screen.getByText("50,00")).toBeInTheDocument(); // Spese non tracc.
    // Totale Spese = aggregazione client (speseTracciate 150 + speseNonTracciate 50 = 200)
    expect(screen.getByText("200,00")).toBeInTheDocument();
  });

  it("imposta il titolo 'Chiusura Mensile - …'", () => {
    renderMonthlyClosureDetails(5);
    expect(mockSetTitle).toHaveBeenCalledWith(expect.stringContaining("Chiusura Mensile -"));
    expect(mockSetTitle).toHaveBeenCalledWith(expect.stringContaining("2026"));
  });

  it("mostra le azioni di toolbar per la bozza (Indietro, Chiudi Mese, Elimina) senza il vecchio pulsante Salva", () => {
    renderMonthlyClosureDetails(5);

    expect(screen.getByText("Indietro")).toBeInTheDocument();
    expect(screen.getByText("Chiudi Mese")).toBeInTheDocument();
    expect(screen.getByText("Elimina")).toBeInTheDocument();
    // Il salvataggio è ora per-riga: il pulsante "Salva" è stato rimosso
    expect(screen.queryByText("Salva")).not.toBeInTheDocument();
  });

  it("mostra l'alert quando la chiusura non viene trovata", () => {
    setupQueries(null);
    renderMonthlyClosureDetails(99);
    expect(screen.getByText("Chiusura non trovata.")).toBeInTheDocument();
  });
});
