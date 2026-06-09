import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { SummaryDataGrid } from "../SummaryDataGrid";

const theme = createTheme();

function renderWithTheme(summaryData: SummaryData, registroCassa?: RegistroCassa | null) {
  return render(
    <ThemeProvider theme={theme}>
      <SummaryDataGrid
        summaryData={summaryData}
        registroCassa={registroCassa}
      />
    </ThemeProvider>
  );
}

const emptySummary: SummaryData = {
  openingTotal: 0,
  closingTotal: 0,
  incomes: [],
  expensesTotalAmount: 0,
  receiptExpensesAmount: 0,
};

describe("SummaryDataGrid", () => {
  it("deve renderizzare tutte le label KPI", () => {
    renderWithTheme(emptySummary);
    expect(screen.getByText("Totale (-) Apertura")).toBeInTheDocument();
    expect(screen.getByText("Pagato Contanti")).toBeInTheDocument();
    expect(screen.getByText("Elett")).toBeInTheDocument();
    expect(screen.getByText("Totale Vendite")).toBeInTheDocument();
    expect(screen.getByText("Spese fornitori")).toBeInTheDocument();
    expect(screen.getByText("ECC")).toBeInTheDocument();
    expect(screen.getByText("Spese ecc")).toBeInTheDocument();
  });

  it("deve usare totaleVendite del server quando registroCassa è valorizzato (il movimento fisico non altera il KPI)", () => {
    // contante 300 + elettronico 150 + fattura 50 = 500 (formula backend)
    // movimento fisico = 280 - 0 = 280: NON deve alterare il Totale Vendite
    const summary: SummaryData = {
      openingTotal: 0,
      closingTotal: 280,
      incomes: [
        { type: "Pago in contanti", amount: 300 },
        { type: "Pagamenti Elettronici", amount: 150 },
        { type: "Pagamento con Fattura", amount: 50 },
      ],
      expensesTotalAmount: 0,
      receiptExpensesAmount: 0,
    };
    const registroCassa = { totaleVendite: 500 } as RegistroCassa;
    renderWithTheme(summary, registroCassa);
    // Totale Vendite = 500 (server), non 480 (vecchia formula con movimento 280)
    expect(screen.getByText("500,00")).toBeInTheDocument();
    expect(screen.queryByText("480,00")).not.toBeInTheDocument();
  });

  it("deve dare precedenza al valore del server anche quando diverge dal calcolo locale", () => {
    const summary: SummaryData = {
      openingTotal: 0,
      closingTotal: 280,
      incomes: [
        { type: "Pago in contanti", amount: 300 },
        { type: "Pagamenti Elettronici", amount: 150 },
        { type: "Pagamento con Fattura", amount: 50 },
      ],
      expensesTotalAmount: 0,
      receiptExpensesAmount: 0,
    };
    const registroCassa = { totaleVendite: 999 } as RegistroCassa;
    renderWithTheme(summary, registroCassa);
    expect(screen.getByText("999,00")).toBeInTheDocument();
    expect(screen.queryByText("500,00")).not.toBeInTheDocument();
  });

  it("deve calcolare il Totale Vendite con la formula backend (contante + elettronico + fattura) senza registroCassa", () => {
    // fallback locale: 50 + 200 + 30 = 280 (NON movimento 300 + 200 + 30 = 530)
    const summary: SummaryData = {
      openingTotal: 100,
      closingTotal: 400,
      incomes: [
        { type: "Pago in contanti", amount: 50 },
        { type: "Pagamenti Elettronici", amount: 200 },
        { type: "Pagamento con Fattura", amount: 30 },
      ],
      expensesTotalAmount: 0,
      receiptExpensesAmount: 0,
    };
    renderWithTheme(summary);
    expect(screen.getByText("280,00")).toBeInTheDocument();
    expect(screen.queryByText("530,00")).not.toBeInTheDocument();
  });

  it("deve mostrare la label ECC", () => {
    renderWithTheme(emptySummary);
    expect(screen.getByText("ECC")).toBeInTheDocument();
  });

  it("deve mostrare Spese ecc per spese scontrino", () => {
    const summary: SummaryData = {
      openingTotal: 0,
      closingTotal: 0,
      incomes: [],
      expensesTotalAmount: 150,
      receiptExpensesAmount: 50,
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
