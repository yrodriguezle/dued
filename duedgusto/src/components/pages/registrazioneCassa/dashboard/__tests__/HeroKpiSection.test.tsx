import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import HeroKpiSection from "../HeroKpiSection";
import { calcolaTrendPercentuale } from "../dashboardUtils";
import { ANNO_TEST, creaMese, creaRiepilogo, meseMarzo, riepilogoVuoto } from "./fixtures/riepilogoDashboardFixtures";

const theme = createTheme();

function renderSection(riepilogo: RiepilogoDashboard, meseRiferimento: RiepilogoMeseDashboard | null, loading = false) {
  return render(
    <ThemeProvider theme={theme}>
      <HeroKpiSection
        riepilogo={riepilogo}
        meseRiferimento={meseRiferimento}
        loading={loading}
      />
    </ThemeProvider>
  );
}

describe("calcolaTrendPercentuale", () => {
  it("calcola la variazione % con la formula (cur − prev) / |prev| × 100", () => {
    expect(calcolaTrendPercentuale(11000, 10000)).toBeCloseTo(10, 5);
    expect(calcolaTrendPercentuale(9000, 10000)).toBeCloseTo(-10, 5);
  });

  it("usa il valore assoluto del precedente (prev negativo)", () => {
    expect(calcolaTrendPercentuale(50, -100)).toBeCloseTo(150, 5);
  });

  it("restituisce null con precedente 0 o assente (mai Infinity/NaN)", () => {
    expect(calcolaTrendPercentuale(100, 0)).toBeNull();
    expect(calcolaTrendPercentuale(100, null)).toBeNull();
    expect(calcolaTrendPercentuale(100, undefined)).toBeNull();
  });
});

describe("HeroKpiSection", () => {
  it("mostra i 7 KPI del mese di riferimento formattati it-IT, al centesimo come la vista mensile", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [meseMarzo]);
    renderSection(riepilogo, meseMarzo);

    // Nota: marzo è l'unico mese con dati, quindi i valori compaiono sia nella
    // banda mensile sia nei totali annuali (getAllByText).
    // Hero: Differenza = 930.70 - 65.50 = 865.20
    expect(screen.getAllByText("€ 865,20").length).toBeGreaterThan(0);
    // Banda densa: gli altri 6 KPI (stesse formule di RiepilogoIncassiMensile)
    expect(screen.getAllByText("€ 930,70").length).toBeGreaterThan(0); // Totale Vendite
    expect(screen.getAllByText("-€ 65,50").length).toBeGreaterThan(0); // Totale Spese
    expect(screen.getAllByText("€ 580,40").length).toBeGreaterThan(0); // Ricavo tracciato
    expect(screen.getAllByText("€ 350,30").length).toBeGreaterThan(0); // Ricavo non tracciato
    expect(screen.getByText("-€ 30,30")).toBeInTheDocument(); // Spese tracciate (solo banda mensile)
    expect(screen.getByText("-€ 35,20")).toBeInTheDocument(); // Spese non tracciate (solo banda mensile)
  });

  it("indica esplicitamente mese e anno di riferimento nell'intestazione", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [meseMarzo]);
    renderSection(riepilogo, meseMarzo);
    expect(screen.getByText(`KPI di Marzo ${ANNO_TEST}`)).toBeInTheDocument();
  });

  it("mostra i chip registri e bozze del mese di riferimento", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [meseMarzo]);
    renderSection(riepilogo, meseMarzo);
    expect(screen.getAllByText("3 registri").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 bozze").length).toBeGreaterThan(0);
  });

  it("mostra il trend % vs mese precedente quando il dato è disponibile", () => {
    const febbraio = creaMese(ANNO_TEST, 2, { totaleVendite: 10000, registri: 20 });
    const marzo = creaMese(ANNO_TEST, 3, { totaleVendite: 11000, registri: 22 });
    const riepilogo = creaRiepilogo(ANNO_TEST, [febbraio, marzo]);
    renderSection(riepilogo, riepilogo.mesi[2]);

    // +10,0% sia sulla Differenza (hero) sia su Totale Vendite (banda)
    expect(screen.getAllByText("+10,0%").length).toBeGreaterThanOrEqual(1);
  });

  it("omette il trend % quando il mese precedente è 0 o assente (niente Infinity%)", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [meseMarzo]); // febbraio vuoto
    renderSection(riepilogo, meseMarzo);

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("mostra la sparkline con almeno 2 mesi con dati", () => {
    const febbraio = creaMese(ANNO_TEST, 2, { totaleVendite: 10000, registri: 20 });
    const marzo = creaMese(ANNO_TEST, 3, { totaleVendite: 11000, registri: 22 });
    const riepilogo = creaRiepilogo(ANNO_TEST, [febbraio, marzo]);
    const { container } = renderSection(riepilogo, riepilogo.mesi[2]);

    expect(container.querySelector(".MuiChartsSurface-root")).not.toBeNull();
  });

  it("omette la sparkline con meno di 2 mesi con dati", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [meseMarzo]);
    const { container } = renderSection(riepilogo, meseMarzo);

    expect(container.querySelector(".MuiChartsSurface-root")).toBeNull();
  });

  it("mostra i totali annuali compatti", () => {
    const riepilogo = creaRiepilogo(ANNO_TEST, [meseMarzo]);
    renderSection(riepilogo, meseMarzo);

    expect(screen.getByText(`Totali ${ANNO_TEST}`)).toBeInTheDocument();
    // I totali annuali coincidono con marzo (unico mese con dati) — le stesse
    // stringhe compaiono quindi due volte (banda mensile + banda annuale)
    expect(screen.getAllByText("€ 930,70").length).toBe(2);
  });

  it("mostra lo skeleton durante il primo caricamento", () => {
    renderSection(riepilogoVuoto, null, true);
    expect(screen.getByTestId("hero-kpi-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/Nessun registro/)).not.toBeInTheDocument();
  });

  it("mostra il messaggio di assenza dati senza mese di riferimento", () => {
    renderSection(riepilogoVuoto, null);
    expect(screen.getByText(`Nessun registro per il ${ANNO_TEST}.`)).toBeInTheDocument();
  });
});
