import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock delle dipendenze (pattern RegistroCassaDetails.test.tsx: vi.mock dei moduli hook). ──

vi.mock("../../../../graphql/registroCassa/useQueryRiepilogoAnnuale", () => ({
  default: vi.fn(),
}));

// Stub della griglia spese: qui si testa SOLO l'orchestrazione (KPI + riepilogo mensile);
// la griglia ha il suo test dedicato (SpeseDataGrid.test.tsx).
vi.mock("../../registrazioneCassa/SpeseDataGrid", () => ({
  default: () => <div data-testid="spese-data-grid" />,
  METODO_CONTANTI: "Contanti",
}));

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useMutation: (...args: unknown[]) => mockUseMutation(...args),
  };
});

// ── Import dopo i mock ─────────────────────────────────────────────────

import LiquiditaPage from "../LiquiditaPage";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import useQueryRiepilogoAnnuale from "../../../../graphql/registroCassa/useQueryRiepilogoAnnuale";

const mockRiepilogoAnnuale = vi.mocked(useQueryRiepilogoAnnuale);

// ── Dati di test ───────────────────────────────────────────────────────

const ANNO = new Date().getFullYear();

function creaMese(mese: number, totaleVendite: number, totaleSpese: number): RiepilogoMeseDashboard {
  return {
    anno: ANNO,
    mese,
    totaleVendite,
    ricavoTracciato: 0,
    ricavoNonTracciato: 0,
    speseTracciate: 0,
    speseNonTracciate: 0,
    incassoContanteTracciato: 0,
    incassiElettronici: 0,
    incassiFattura: 0,
    registri: 1,
    chiusi: 0,
    bozze: 0,
    totaleSpese,
    differenza: totaleVendite - totaleSpese,
  };
}

describe("LiquiditaPage", () => {
  const mockSetTitle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockImplementation((query: unknown) => {
      // getLiquiditaCassa
      if ((query as { kind?: string }) && typeof query === "object" && "definitions" in (query as object)) {
        const doc = query as { definitions?: { name?: { value?: string } }[] };
        const name = doc.definitions?.map((d) => d.name?.value).join(",") ?? "";
        if (name.includes("GetLiquiditaCassa")) {
          return { data: { gestioneCassa: { liquiditaCassa: { totaleVendite: 1000, totaleSpese: 400, saldoIniziale: 50, liquidita: 650 } } }, loading: false, error: undefined, refetch: vi.fn() };
        }
        if (name.includes("GetCategorieSpesa")) {
          return { data: { gestioneCassa: { categorieSpesa: [{ id: 1, nome: "Beni", attiva: true, ordine: 0 }, { id: 2, nome: "Altro", attiva: true, ordine: 1 }] } }, loading: false, error: undefined };
        }
      }
      return { data: undefined, loading: false, error: undefined };
    });

    mockUseMutation.mockImplementation(() => [vi.fn(), { loading: false }]);

    mockRiepilogoAnnuale.mockReturnValue({
      mesi: [
        creaMese(1, 300, 100),
        creaMese(2, 0, 0),
        creaMese(3, 700, 300),
        ...Array.from({ length: 9 }, (_, i) => creaMese(i + 4, 0, 0)),
      ],
      hasData: true,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      schemaNonDisponibile: false,
    });
  });

  function renderPage() {
    return render(
      <PageTitleContext.Provider value={{ title: "", setTitle: mockSetTitle }}>
        <LiquiditaPage />
      </PageTitleContext.Provider>
    );
  }

  it("mostra la liquidità cumulativa e il saldo iniziale", () => {
    renderPage();

    expect(screen.getByText("Liquidità disponibile")).toBeInTheDocument();
    expect(screen.getByText("Totale vendite")).toBeInTheDocument();
    expect(screen.getByText("Totale spese")).toBeInTheDocument();
    expect(screen.getByText("Saldo iniziale")).toBeInTheDocument();
  });

  it("elenca i 12 mesi con vendite, spese e differenza", () => {
    renderPage();

    // I 12 mesi devono essere tutti presenti (Gennaio…Dicembre).
    expect(screen.getByText("Gennaio")).toBeInTheDocument();
    expect(screen.getByText("Dicembre")).toBeInTheDocument();
    // Un mese con dati: Marzo ha vendite 700 (spese 300 → differenza 400).
    expect(screen.getByText("700,00")).toBeInTheDocument();
    expect(screen.getByText("200,00")).toBeInTheDocument();
  });

  it("monta la griglia spese riusata", () => {
    renderPage();
    expect(screen.getByTestId("spese-data-grid")).toBeInTheDocument();
  });

  it("imposta il titolo della pagina", () => {
    renderPage();
    expect(mockSetTitle).toHaveBeenCalledWith("Liquidità");
  });
});
