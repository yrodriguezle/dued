import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApolloError } from "@apollo/client";

// ── Mock delle dipendenze (pattern MonthlyClosureDetails.test.tsx: vi.mock dei moduli hook) ──

vi.mock("../../../../store/useStore", () => {
  const mockStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  });
  return { default: mockStore };
});

vi.mock("../dashboard/useDashboardData", () => ({
  default: vi.fn(),
}));

// Stub delle sezioni presentazionali: qui si testa SOLO l'orchestrazione
// (Alert errore + Riprova), le sezioni hanno test dedicati.
vi.mock("../dashboard/HeroKpiSection", () => ({
  default: () => <div data-testid="hero-kpi-section" />,
}));
vi.mock("../dashboard/SankeyFlussoCassaLazy", () => ({
  default: () => <div data-testid="sankey-flusso-cassa" />,
}));
vi.mock("../dashboard/DonutDistribuzioneIncassi", () => ({
  default: () => <div data-testid="donut-distribuzione-incassi" />,
}));
vi.mock("../dashboard/TrendMensile", () => ({
  default: () => <div data-testid="trend-mensile" />,
}));

// ── Import dopo i mock ─────────────────────────────────────────────────

import useStore from "../../../../store/useStore";
import useDashboardData from "../dashboard/useDashboardData";
import RegistrazioneCassDashboard from "../RegistrazioneCassDashboard";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import { MESI_LABEL, periodoMesePrecedente } from "../dashboard/dashboardUtils";
import { DataRouterTestWrapper } from "../../../../test/helpers/dataRouterTestWrapper";

const mockUseStore = vi.mocked(useStore);
const mockUseDashboardData = vi.mocked(useDashboardData);

// ── Dati di test ───────────────────────────────────────────────────────

const ANNO = new Date().getFullYear();

const creaMese = (mese: number, overrides: Partial<RiepilogoMeseDashboard> = {}): RiepilogoMeseDashboard => ({
  anno: ANNO,
  mese,
  totaleVendite: 0,
  ricavoTracciato: 0,
  ricavoNonTracciato: 0,
  speseTracciate: 0,
  speseNonTracciate: 0,
  incassoContanteTracciato: 0,
  incassiElettronici: 0,
  incassiFattura: 0,
  registri: 0,
  chiusi: 0,
  bozze: 0,
  totaleSpese: 0,
  differenza: 0,
  ...overrides,
});

const creaRiepilogo = (mesi: RiepilogoMeseDashboard[], registri: number): RiepilogoDashboard => ({
  anno: ANNO,
  mesi,
  totaliAnno: { ...creaMese(1), registri },
  meseCorrente: null,
  fonte: "server",
});

const riepilogoVuoto = creaRiepilogo([], 0);
const riepilogoConDati = creaRiepilogo(
  Array.from({ length: 12 }, (_, indice) => creaMese(indice + 1, indice === 2 ? { totaleVendite: 300, registri: 1, chiusi: 1 } : {})),
  1
);

const mockRefetch = vi.fn();
const mockSetTitle = vi.fn();

type UseDashboardDataReturn = ReturnType<typeof useDashboardData>;

const statoErrore: UseDashboardDataReturn = {
  riepilogo: riepilogoVuoto,
  meseRiferimento: null,
  fonte: "server",
  loading: false,
  error: new ApolloError({ networkError: new Error("Failed to fetch") }),
  refetch: mockRefetch,
};

const statoSuccesso: UseDashboardDataReturn = {
  riepilogo: riepilogoConDati,
  meseRiferimento: riepilogoConDati.mesi[2],
  fonte: "server",
  loading: false,
  error: undefined,
  refetch: mockRefetch,
};

// ── Helper ─────────────────────────────────────────────────────────────

function setupStore() {
  mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
    const state = {
      getNextOperatingDate: vi.fn(() => new Date(`${ANNO}-07-04T12:00:00`)),
    } as unknown as Store;
    return selector(state);
  });
}

function renderDashboard() {
  return render(
    <PageTitleContext.Provider value={{ title: "", setTitle: mockSetTitle }}>
      <DataRouterTestWrapper>
        <RegistrazioneCassDashboard />
      </DataRouterTestWrapper>
    </PageTitleContext.Provider>
  );
}

// ── Test ────────────────────────────────────────────────────────────────

describe("RegistrazioneCassDashboard — Gestione errori", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it("errore di rete con retry: Alert in italiano con 'Riprova' → click → refetch → dashboard popolata", async () => {
    const user = userEvent.setup();
    mockUseDashboardData.mockReturnValue(statoErrore);

    const { rerender } = renderDashboard();

    // Alert di errore localizzato, nessuna sezione dati renderizzata
    expect(screen.getByText(/Errore nel caricamento della dashboard/)).toBeInTheDocument();
    expect(screen.queryByTestId("hero-kpi-section")).not.toBeInTheDocument();

    // Click su "Riprova" → la query viene rieseguita (refetch)
    await user.click(screen.getByRole("button", { name: "Riprova" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    // In caso di successo la dashboard si popola normalmente
    mockUseDashboardData.mockReturnValue(statoSuccesso);
    rerender(
      <PageTitleContext.Provider value={{ title: "", setTitle: mockSetTitle }}>
        <DataRouterTestWrapper>
          <RegistrazioneCassDashboard />
        </DataRouterTestWrapper>
      </PageTitleContext.Provider>
    );

    expect(screen.queryByText(/Errore nel caricamento della dashboard/)).not.toBeInTheDocument();
    expect(screen.getByTestId("hero-kpi-section")).toBeInTheDocument();
    expect(screen.getByTestId("sankey-flusso-cassa")).toBeInTheDocument();
    expect(screen.getByTestId("donut-distribuzione-incassi")).toBeInTheDocument();
    expect(screen.getByTestId("trend-mensile")).toBeInTheDocument();
  });
});

describe("RegistrazioneCassDashboard — periodo di riferimento", () => {
  const periodoIniziale = periodoMesePrecedente();

  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
    mockUseDashboardData.mockReturnValue(statoSuccesso);
  });

  it("parte dal mese precedente (ultimo mese completo), non dal mese in corso", () => {
    renderDashboard();

    expect(mockUseDashboardData).toHaveBeenCalledWith({ anno: periodoIniziale.anno, mese: periodoIniziale.mese });
    expect(screen.getByRole("combobox", { name: "Mese" })).toHaveTextContent(MESI_LABEL[periodoIniziale.mese - 1]);
    expect(screen.getByRole("combobox", { name: "Anno" })).toHaveTextContent(String(periodoIniziale.anno));
  });

  it("il cambio mese dall'header aggiorna il periodo interrogato mantenendo l'anno", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("combobox", { name: "Mese" }));
    await user.click(screen.getByRole("option", { name: "Marzo" }));

    expect(mockUseDashboardData).toHaveBeenLastCalledWith({ anno: periodoIniziale.anno, mese: 3 });
  });

  it("il cambio anno dall'header mantiene il mese selezionato", async () => {
    const user = userEvent.setup();
    renderDashboard();

    const annoPrecedente = periodoIniziale.anno - 1;
    await user.click(screen.getByRole("combobox", { name: "Anno" }));
    await user.click(screen.getByRole("option", { name: String(annoPrecedente) }));

    expect(mockUseDashboardData).toHaveBeenLastCalledWith({ anno: annoPrecedente, mese: periodoIniziale.mese });
  });
});
