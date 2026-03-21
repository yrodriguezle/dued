import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { SummaryDataGrid } from "../SummaryDataGrid";

const theme = createTheme();

function renderWithTheme(summaryData: SummaryData) {
  return render(
    <ThemeProvider theme={theme}>
      <SummaryDataGrid summaryData={summaryData} />
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

  it("deve calcolare correttamente il Totale Vendite", () => {
    // movimento = 400 - 100 = 300; elettronico = 200; totalSales = 300 + 200 = 500
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
    expect(screen.getByText("Totale Vendite")).toBeInTheDocument();
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
