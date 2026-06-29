import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import RiepilogoCards from "../RiepilogoCards";

const theme = createTheme();

function renderWithTheme(riepilogoGiornaliero: RiepilogoGiornaliero, registroCassa?: RegistroCassa | null) {
  return render(
    <ThemeProvider theme={theme}>
      <RiepilogoCards
        riepilogoGiornaliero={riepilogoGiornaliero}
        registroCassa={registroCassa}
      />
    </ThemeProvider>
  );
}

const emptySummary: RiepilogoGiornaliero = {
  totaleApertura: 0,
  totaleChiusura: 0,
  incassi: [],
  totaleSpese: 0,
  speseScontrino: 0,
};

describe("RiepilogoCards", () => {
  it("deve renderizzare tutte le label KPI", () => {
    renderWithTheme(emptySummary);
    expect(screen.getByText("Totale - apertura")).toBeInTheDocument();
    expect(screen.getByText("Pagato contanti")).toBeInTheDocument();
    expect(screen.getByText("Elettronico")).toBeInTheDocument();
    expect(screen.getByText("Totale vendite")).toBeInTheDocument();
    expect(screen.getByText("Spese fornitori")).toBeInTheDocument();
    expect(screen.getByText("ECC")).toBeInTheDocument();
    expect(screen.getByText("Spese ecc")).toBeInTheDocument();
  });

  it("deve calcolare Totale Vendite = movimento + elettronico + fattura (NON il 'Pago in contanti' digitato)", () => {
    // movimento fisico = 280 - 0 = 280 (ricavato contante reale)
    // 'Pago in contanti' 300 è solo un subset digitato e NON va usato come contante
    // Totale Vendite = 280 + 150 + 50 = 480
    const summary: RiepilogoGiornaliero = {
      totaleApertura: 0,
      totaleChiusura: 280,
      incassi: [
        { tipo: "Pago in contanti", importo: 300 },
        { tipo: "Pagamenti Elettronici", importo: 150 },
        { tipo: "Pagamento con Fattura", importo: 50 },
      ],
      totaleSpese: 0,
      speseScontrino: 0,
    };
    renderWithTheme(summary);
    expect(screen.getByText("480,00")).toBeInTheDocument();
    // 500 = se usasse erroneamente il contante digitato (300 + 150 + 50)
    expect(screen.queryByText("500,00")).not.toBeInTheDocument();
  });

  it("il totaleVendite del server NON sovrascrive il calcolo locale (movimento)", () => {
    const summary: RiepilogoGiornaliero = {
      totaleApertura: 0,
      totaleChiusura: 280,
      incassi: [
        { tipo: "Pago in contanti", importo: 300 },
        { tipo: "Pagamenti Elettronici", importo: 150 },
        { tipo: "Pagamento con Fattura", importo: 50 },
      ],
      totaleSpese: 0,
      speseScontrino: 0,
    };
    const registroCassa = { totaleVendite: 999 } as RegistroCassa;
    renderWithTheme(summary, registroCassa);
    // resta 480 (movimento 280 + 150 + 50), il 999 del server è ignorato per il KPI
    expect(screen.getByText("480,00")).toBeInTheDocument();
    expect(screen.queryByText("999,00")).not.toBeInTheDocument();
  });

  it("Totale Vendite usa il movimento fisico, non il 'Pago in contanti' digitato", () => {
    // movimento = 400 - 100 = 300; Totale Vendite = 300 + 200 + 30 = 530
    const summary: RiepilogoGiornaliero = {
      totaleApertura: 100,
      totaleChiusura: 400,
      incassi: [
        { tipo: "Pago in contanti", importo: 50 },
        { tipo: "Pagamenti Elettronici", importo: 200 },
        { tipo: "Pagamento con Fattura", importo: 30 },
      ],
      totaleSpese: 0,
      speseScontrino: 0,
    };
    renderWithTheme(summary);
    expect(screen.getByText("530,00")).toBeInTheDocument();
    // 280 = se usasse il contante digitato 50 + 200 + 30
    expect(screen.queryByText("280,00")).not.toBeInTheDocument();
  });

  it("deve mostrare la label ECC", () => {
    renderWithTheme(emptySummary);
    expect(screen.getByText("ECC")).toBeInTheDocument();
  });

  it("deve mostrare Spese ecc per spese scontrino", () => {
    const summary: RiepilogoGiornaliero = {
      totaleApertura: 0,
      totaleChiusura: 0,
      incassi: [],
      totaleSpese: 150,
      speseScontrino: 50,
    };
    renderWithTheme(summary);
    expect(screen.getByText("Spese ecc")).toBeInTheDocument();
    expect(screen.getByText("Spese fornitori")).toBeInTheDocument();
  });

  it("non deve mostrare il titolo RIEPILOGO VENDITE", () => {
    renderWithTheme(emptySummary);
    expect(screen.queryByText("RIEPILOGO VENDITE")).not.toBeInTheDocument();
  });

  describe("breakdown IVA", () => {
    const makeRiga = (
      aliquota: number,
      imponibile: number,
      imposta: number,
      stimato: boolean
    ): RegistroCassaIvaRiga => ({
      __typename: "RegistroCassaIva",
      aliquota,
      imponibile,
      imposta,
      stimato,
    });

    it("deve renderizzare il breakdown misto con una riga per aliquota e il totale IVA", () => {
      // Scenario "Dettaglio registro con breakdown misto": due righe esatte (22%, 10%)
      // + una riga stimata per il residuo all'aliquota di default
      const registroCassa = {
        totaleVendite: 100,
        importoIva: 12.36,
        breakdownIva: [
          makeRiga(22, 30, 6.6, false),
          makeRiga(10, 20, 2, false),
          makeRiga(10, 37.64, 3.76, true),
        ],
      } as RegistroCassa;
      renderWithTheme(emptySummary, registroCassa);

      expect(screen.getByText("IVA (totale € 12,36)")).toBeInTheDocument();
      expect(screen.getByText("22% — Imponibile € 30,00 · IVA € 6,60")).toBeInTheDocument();
      expect(screen.getByText("10% — Imponibile € 20,00 · IVA € 2,00")).toBeInTheDocument();
      expect(screen.getByText("10% — Imponibile € 37,64 · IVA € 3,76")).toBeInTheDocument();
    });

    it("deve mostrare il Chip 'stimato' SOLO sulla riga stimata", () => {
      const registroCassa = {
        totaleVendite: 100,
        importoIva: 12.36,
        breakdownIva: [
          makeRiga(22, 30, 6.6, false),
          makeRiga(10, 20, 2, false),
          makeRiga(10, 37.64, 3.76, true),
        ],
      } as RegistroCassa;
      renderWithTheme(emptySummary, registroCassa);

      const chips = screen.getAllByText("stimato");
      expect(chips).toHaveLength(1);
      // Il badge appartiene alla riga stimata (37,64 / 3,76), non alle righe esatte
      const rigaStimata = screen.getByText("10% — Imponibile € 37,64 · IVA € 3,76");
      expect(rigaStimata.parentElement).toContainElement(chips[0]);
      const rigaEsatta = screen.getByText("22% — Imponibile € 30,00 · IVA € 6,60");
      expect(rigaEsatta.parentElement).not.toContainElement(chips[0]);
    });

    it("deve mostrare un'unica riga marcata 'stimato' per registro storico backfillato", () => {
      // Scenario "Dettaglio registro storico": sola riga stimata aggregata
      const registroCassa = {
        totaleVendite: 80,
        importoIva: 7.27,
        breakdownIva: [makeRiga(10, 72.73, 7.27, true)],
      } as RegistroCassa;
      renderWithTheme(emptySummary, registroCassa);

      expect(screen.getByText("IVA (totale € 7,27)")).toBeInTheDocument();
      expect(screen.getByText("10% — Imponibile € 72,73 · IVA € 7,27")).toBeInTheDocument();
      expect(screen.getAllByText("stimato")).toHaveLength(1);
    });

    it("non deve mostrare il blocco senza registroCassa", () => {
      renderWithTheme(emptySummary);
      expect(screen.queryByText(/IVA \(totale/)).not.toBeInTheDocument();
      expect(screen.queryByText("stimato")).not.toBeInTheDocument();
    });

    it("non deve mostrare il blocco con breakdownIva vuoto", () => {
      const registroCassa = {
        totaleVendite: 500,
        importoIva: 0,
        breakdownIva: [],
      } as unknown as RegistroCassa;
      renderWithTheme(emptySummary, registroCassa);
      expect(screen.queryByText(/IVA \(totale/)).not.toBeInTheDocument();
    });
  });
});
