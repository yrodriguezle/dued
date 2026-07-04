import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import SankeyErrorBoundary from "../SankeyErrorBoundary";
import FlussoCassaBarreImpilate from "../FlussoCassaBarreImpilate";
import logger from "../../../../../common/logger/logger";
import { ANNO_TEST, creaMese, creaRiepilogo, riepilogoVuoto } from "./fixtures/riepilogoDashboardFixtures";

vi.mock("../../../../../common/logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const theme = createTheme();

/** Simula il crash di rendering di Recharts (recharts#6857 con React 19). */
function SankeyCheEsplode(): never {
  throw new Error("recharts#6857");
}

describe("SankeyErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza i figli quando non ci sono errori", () => {
    render(
      <SankeyErrorBoundary fallback={<div data-testid="fallback-flusso" />}>
        <div data-testid="sankey-ok" />
      </SankeyErrorBoundary>
    );

    expect(screen.getByTestId("sankey-ok")).toBeInTheDocument();
    expect(screen.queryByTestId("fallback-flusso")).not.toBeInTheDocument();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("monta il fallback e logga via logger quando il figlio lancia, senza toccare il resto dell'albero", () => {
    // React logga comunque l'errore catturato su console.error: silenziato
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <div>
        <div data-testid="resto-dashboard">KPI e altri grafici</div>
        <SankeyErrorBoundary fallback={<div data-testid="fallback-flusso" />}>
          <SankeyCheEsplode />
        </SankeyErrorBoundary>
      </div>
    );

    // Il fallback è montato e il resto della dashboard resta funzionante
    expect(screen.getByTestId("fallback-flusso")).toBeInTheDocument();
    expect(screen.getByTestId("resto-dashboard")).toBeInTheDocument();
    // L'errore è loggato tramite il logger dell'app (non console diretta)
    expect(logger.error).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it("degrada al fallback reale a barre impilate con gli stessi aggregati del flusso", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const riepilogo = creaRiepilogo(ANNO_TEST, [
      creaMese(ANNO_TEST, 3, {
        totaleVendite: 1000,
        ricavoTracciato: 700,
        ricavoNonTracciato: 300,
        speseTracciate: 200,
        speseNonTracciate: 100,
        registri: 3,
      }),
    ]);

    render(
      <ThemeProvider theme={theme}>
        <SankeyErrorBoundary fallback={<FlussoCassaBarreImpilate riepilogo={riepilogo} />}>
          <SankeyCheEsplode />
        </SankeyErrorBoundary>
      </ThemeProvider>
    );

    expect(screen.getByText(`Flusso di cassa ${ANNO_TEST}`)).toBeInTheDocument();
    expect(screen.getAllByText("Ricavo tracciato").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Netto").length).toBeGreaterThan(0);
    expect(logger.error).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});

describe("FlussoCassaBarreImpilate (fallback autonomo)", () => {
  function renderBarre(riepilogo: RiepilogoDashboard, loading = false) {
    return render(
      <ThemeProvider theme={theme}>
        <FlussoCassaBarreImpilate
          riepilogo={riepilogo}
          loading={loading}
        />
      </ThemeProvider>
    );
  }

  it("renderizza le serie del flusso (ricavi e impieghi) senza Recharts", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [
      creaMese(ANNO_TEST, 3, {
        totaleVendite: 1000,
        ricavoTracciato: 700,
        ricavoNonTracciato: 300,
        speseTracciate: 200,
        speseNonTracciate: 100,
        registri: 3,
      }),
    ]);
    renderBarre(riepilogo);

    expect(screen.getByText(`Flusso di cassa ${ANNO_TEST}`)).toBeInTheDocument();
    ["Ricavo tracciato", "Ricavo non tracciato", "Spese tracciate", "Spese non tracciate", "Netto"].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });

  it("segnala il netto negativo con il valore reale e clampa i valori nel grafico", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [
      creaMese(ANNO_TEST, 5, {
        totaleVendite: 100,
        ricavoTracciato: 100,
        ricavoNonTracciato: -40,
        speseTracciate: 150,
        speseNonTracciate: 0,
        registri: 1,
      }),
    ]);
    renderBarre(riepilogo);

    // differenza reale = 100 − 150 = −50
    expect(screen.getByText(`Netto negativo (€ -50,00): le spese superano le vendite del ${ANNO_TEST}.`)).toBeInTheDocument();
    // nota clamp del ricavo non tracciato negativo
    expect(screen.getByText(/Ricavo non tracciato negativo \(€ -40,00\)/)).toBeInTheDocument();
  });

  it("mostra l'empty state per un anno senza registri", () => {
    renderBarre(riepilogoVuoto);
    expect(screen.getByText(`Nessun dato per il ${ANNO_TEST}.`)).toBeInTheDocument();
  });

  it("mostra lo skeleton durante il caricamento", () => {
    renderBarre(riepilogoVuoto, true);
    expect(screen.getByTestId("flusso-barre-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/Nessun dato/)).not.toBeInTheDocument();
  });
});
