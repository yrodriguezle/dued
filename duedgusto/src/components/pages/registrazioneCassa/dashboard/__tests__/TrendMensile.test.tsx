import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import TrendMensile from "../TrendMensile";
import { MESI_BREVI, serieDodiciMesi } from "../dashboardUtils";
import { ANNO_TEST, creaMese, creaRiepilogo, riepilogoVuoto } from "./fixtures/riepilogoDashboardFixtures";

const theme = createTheme();

function renderTrend(riepilogo: RiepilogoDashboard, loading = false) {
  return render(
    <ThemeProvider theme={theme}>
      <TrendMensile
        riepilogo={riepilogo}
        loading={loading}
      />
    </ThemeProvider>
  );
}

describe("serieDodiciMesi", () => {
  it("produce sempre 12 punti, con 0 per i mesi assenti (anno parziale)", () => {
    const gennaio = creaMese(ANNO_TEST, 1, { totaleVendite: 100, registri: 1 });
    const aprile = creaMese(ANNO_TEST, 4, { totaleVendite: 400, registri: 1 });
    const serie = serieDodiciMesi([gennaio, aprile], (mese) => mese.totaleVendite);

    expect(serie).toHaveLength(12);
    expect(serie[0]).toBe(100);
    expect(serie[3]).toBe(400);
    // Mesi da maggio a dicembre a 0, nessun buco d'asse
    expect(serie.slice(4)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("produce 12 zeri con input vuoto", () => {
    expect(serieDodiciMesi([], (mese) => mese.differenza)).toEqual(Array.from({ length: 12 }, () => 0));
  });

  it("ha 12 etichette mese Gen–Dic", () => {
    expect(MESI_BREVI).toHaveLength(12);
    expect(MESI_BREVI[0]).toBe("Gen");
    expect(MESI_BREVI[11]).toBe("Dic");
  });
});

describe("TrendMensile", () => {
  it("mostra il titolo con l'anno selezionato", () => {
    const mese = creaMese(ANNO_TEST, 3, { totaleVendite: 1000, registri: 5 });
    renderTrend(creaRiepilogo(ANNO_TEST, [mese]));
    expect(screen.getByText(`Trend mensile ${ANNO_TEST}`)).toBeInTheDocument();
  });

  it("mostra le serie barre (Vendite/Spese) e linee (Differenza, tracciato, non tracciato) in legenda", () => {
    const mese = creaMese(ANNO_TEST, 3, {
      totaleVendite: 1000,
      ricavoTracciato: 700,
      ricavoNonTracciato: 300,
      speseTracciate: 200,
      registri: 5,
    });
    renderTrend(creaRiepilogo(ANNO_TEST, [mese]));

    expect(screen.getByText("Vendite")).toBeInTheDocument();
    expect(screen.getByText("Spese")).toBeInTheDocument();
    expect(screen.getByText("Differenza")).toBeInTheDocument();
    expect(screen.getByText("Ricavo tracciato")).toBeInTheDocument();
    expect(screen.getByText("Ricavo non tracciato")).toBeInTheDocument();
  });

  it("mostra l'empty state per un anno senza registri", () => {
    renderTrend(riepilogoVuoto);
    expect(screen.getByText(`Nessun dato per il ${ANNO_TEST}.`)).toBeInTheDocument();
    expect(screen.queryByText("Vendite")).not.toBeInTheDocument();
  });

  it("mostra lo skeleton durante il caricamento", () => {
    renderTrend(riepilogoVuoto, true);
    expect(screen.getByTestId("trend-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/Nessun dato/)).not.toBeInTheDocument();
  });
});
