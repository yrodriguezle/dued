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
});
