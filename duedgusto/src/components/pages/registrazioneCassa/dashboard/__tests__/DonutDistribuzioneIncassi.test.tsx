import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import DonutDistribuzioneIncassi from "../DonutDistribuzioneIncassi";
import { ANNO_TEST, creaMese, creaRiepilogo, meseMarzo, riepilogoVuoto } from "./fixtures/riepilogoDashboardFixtures";

const theme = createTheme();

function renderDonut(riepilogo: RiepilogoDashboard, loading = false) {
  return render(
    <ThemeProvider theme={theme}>
      <DonutDistribuzioneIncassi
        riepilogo={riepilogo}
        loading={loading}
      />
    </ThemeProvider>
  );
}

describe("DonutDistribuzioneIncassi", () => {
  it("mostra le 4 categorie in legenda con valori formattati e percentuali", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [meseMarzo]);
    renderDonut(riepilogo);

    expect(screen.getByText("Contante tracciato")).toBeInTheDocument();
    expect(screen.getByText("Elettronici")).toBeInTheDocument();
    expect(screen.getByText("Fatture")).toBeInTheDocument();
    expect(screen.getByText("Non tracciato")).toBeInTheDocument();

    // Somma fette = ricavo tracciato (580,40) + non tracciato (350,30) = 930,70
    // Percentuali: contante 300,10/930,70 = 32,2% ecc.
    expect(screen.getByText("€ 300,10 · 32,2%")).toBeInTheDocument();
    expect(screen.getByText("€ 230,25 · 24,7%")).toBeInTheDocument();
    expect(screen.getByText("€ 50,05 · 5,4%")).toBeInTheDocument();
    expect(screen.getByText("€ 350,30 · 37,6%")).toBeInTheDocument();
  });

  it("mostra il totale vendite dell'anno al centro del donut", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [meseMarzo]);
    renderDonut(riepilogo);

    expect(screen.getByText(`Vendite ${ANNO_TEST}`)).toBeInTheDocument();
    expect(screen.getByText("€ 930,70")).toBeInTheDocument();
  });

  it("mantiene in legenda a zero le categorie senza incassi", () => {
    const mese = creaMese(ANNO_TEST, 5, {
      totaleVendite: 300,
      ricavoTracciato: 200,
      ricavoNonTracciato: 100,
      incassoContanteTracciato: 100,
      incassiElettronici: 100,
      incassiFattura: 0, // nessuna fattura nell'anno
      registri: 2,
    });
    renderDonut(creaRiepilogo(ANNO_TEST, [mese]));

    expect(screen.getByText("Fatture")).toBeInTheDocument();
    expect(screen.getByText("€ 0,00 · 0,0%")).toBeInTheDocument();
  });

  it("clampa a 0 il ricavo non tracciato negativo con nota testuale", () => {
    const mese = creaMese(ANNO_TEST, 7, {
      totaleVendite: 200,
      ricavoTracciato: 350,
      ricavoNonTracciato: -150,
      incassoContanteTracciato: 250,
      incassiElettronici: 100,
      incassiFattura: 0,
      registri: 1,
    });
    renderDonut(creaRiepilogo(ANNO_TEST, [mese]));

    // In legenda il segmento clampato vale 0
    const zeri = screen.getAllByText("€ 0,00 · 0,0%");
    expect(zeri.length).toBe(2); // fatture 0 + non tracciato clampato
    // Nota con il valore reale
    expect(screen.getByText("Non tracciato negativo (€ -150,00): mostrato a 0 nel grafico.")).toBeInTheDocument();
  });

  it("mostra l'empty state senza alcun incasso", () => {
    renderDonut(riepilogoVuoto);
    expect(screen.getByText(`Nessun incasso per il ${ANNO_TEST}.`)).toBeInTheDocument();
  });

  it("mostra lo skeleton durante il caricamento", () => {
    renderDonut(riepilogoVuoto, true);
    expect(screen.getByTestId("donut-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/Nessun incasso/)).not.toBeInTheDocument();
  });
});
