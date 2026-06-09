import { describe, it, expect } from "vitest";
import syncExpenseRowsWithPagamenti from "../syncExpenseRowsWithPagamenti";

function makeFatturaPagamento(overrides: { pagamentoId: number; fornitoreId: number; numeroFattura: string; fatturaId: number; importo?: number }): PagamentoFornitoreRegistro {
  return {
    pagamentoId: overrides.pagamentoId,
    importo: overrides.importo ?? 100,
    fattura: {
      fatturaId: overrides.fatturaId,
      numeroFattura: overrides.numeroFattura,
      fornitore: { fornitoreId: overrides.fornitoreId, ragioneSociale: "Fornitore" },
    },
  };
}

function makeDdtPagamento(overrides: { pagamentoId: number; fornitoreId: number; numeroDdt: string; ddtId: number; importo?: number }): PagamentoFornitoreRegistro {
  return {
    pagamentoId: overrides.pagamentoId,
    importo: overrides.importo ?? 100,
    ddt: {
      ddtId: overrides.ddtId,
      numeroDdt: overrides.numeroDdt,
      fornitore: { fornitoreId: overrides.fornitoreId, ragioneSociale: "Fornitore" },
    },
  };
}

function makeFatturaRow(overrides: Partial<Expense> = {}): Expense {
  return {
    description: "Pagamento Fornitore - FA",
    amount: 100,
    isPagamentoFornitore: true,
    fornitoreId: 1,
    documentType: "FA",
    invoiceNumber: "10",
    ...overrides,
  };
}

function makeDdtRow(overrides: Partial<Expense> = {}): Expense {
  return {
    description: "Pagamento Fornitore - DDT",
    amount: 100,
    isPagamentoFornitore: true,
    fornitoreId: 1,
    documentType: "DDT",
    ddtNumber: "20",
    ...overrides,
  };
}

describe("syncExpenseRowsWithPagamenti", () => {
  it("abbina per chiave esatta fornitore|tipo|numero e assegna gli ID server", () => {
    const row = makeDdtRow({ fornitoreId: 5, ddtNumber: "123" });
    const pagamento = makeDdtPagamento({ pagamentoId: 77, fornitoreId: 5, numeroDdt: "123", ddtId: 33 });

    const { updates, mismatch } = syncExpenseRowsWithPagamenti([row], [pagamento]);

    expect(mismatch).toBe(false);
    expect(updates).toHaveLength(1);
    expect(updates[0].row).toBe(row);
    expect(updates[0].changes).toMatchObject({ pagamentoId: 77, ddtId: 33, ddtNumber: "123" });
    expect(updates[0].changes.fatturaId).toBeUndefined();
  });

  it("non scambia gli ID tra righe miste fattura e DDT (match per chiave, non per indice)", () => {
    const rowFattura = makeFatturaRow({ fornitoreId: 1, invoiceNumber: "10" });
    const rowDdt = makeDdtRow({ fornitoreId: 2, ddtNumber: "20" });
    // Ordine server invertito rispetto alle righe griglia
    const pagamentoDdt = makeDdtPagamento({ pagamentoId: 200, fornitoreId: 2, numeroDdt: "20", ddtId: 22 });
    const pagamentoFattura = makeFatturaPagamento({ pagamentoId: 100, fornitoreId: 1, numeroFattura: "10", fatturaId: 11 });

    const { updates, mismatch } = syncExpenseRowsWithPagamenti([rowFattura, rowDdt], [pagamentoDdt, pagamentoFattura]);

    expect(mismatch).toBe(false);
    expect(updates).toHaveLength(2);
    const updateFattura = updates.find((u) => u.row === rowFattura);
    const updateDdt = updates.find((u) => u.row === rowDdt);
    expect(updateFattura?.changes).toMatchObject({ pagamentoId: 100, fatturaId: 11, invoiceNumber: "10" });
    expect(updateFattura?.changes.ddtId).toBeUndefined();
    expect(updateDdt?.changes).toMatchObject({ pagamentoId: 200, ddtId: 22, ddtNumber: "20" });
    expect(updateDdt?.changes.fatturaId).toBeUndefined();
  });

  it("abbina in seconda passata le righe senza numero riscrivendo il placeholder del server", () => {
    const row = makeDdtRow({ fornitoreId: 7, ddtNumber: "", amount: 50 });
    const pagamento = makeDdtPagamento({ pagamentoId: 9, fornitoreId: 7, numeroDdt: "SN-20260609-1", ddtId: 44, importo: 50 });

    const { updates, mismatch } = syncExpenseRowsWithPagamenti([row], [pagamento]);

    expect(mismatch).toBe(false);
    expect(updates).toHaveLength(1);
    expect(updates[0].changes).toMatchObject({ pagamentoId: 9, ddtId: 44, ddtNumber: "SN-20260609-1" });
  });

  it("nella seconda passata preferisce il pagamento con importo uguale", () => {
    const rowA = makeDdtRow({ fornitoreId: 7, ddtNumber: "", amount: 20 });
    const rowB = makeDdtRow({ fornitoreId: 7, ddtNumber: "", amount: 10 });
    const pagamento1 = makeDdtPagamento({ pagamentoId: 1, fornitoreId: 7, numeroDdt: "SN-20260609-1", ddtId: 101, importo: 10 });
    const pagamento2 = makeDdtPagamento({ pagamentoId: 2, fornitoreId: 7, numeroDdt: "SN-20260609-2", ddtId: 102, importo: 20 });

    const { updates, mismatch } = syncExpenseRowsWithPagamenti([rowA, rowB], [pagamento1, pagamento2]);

    expect(mismatch).toBe(false);
    const updateA = updates.find((u) => u.row === rowA);
    const updateB = updates.find((u) => u.row === rowB);
    expect(updateA?.changes).toMatchObject({ pagamentoId: 2, ddtId: 102, ddtNumber: "SN-20260609-2" });
    expect(updateB?.changes).toMatchObject({ pagamentoId: 1, ddtId: 101, ddtNumber: "SN-20260609-1" });
  });

  it("ignora le righe spesa normali (non pagamento fornitore)", () => {
    const normalRow: Expense = { description: "Spesa scontrino", amount: 15 };
    const row = makeFatturaRow({ fornitoreId: 3, invoiceNumber: "55" });
    const pagamento = makeFatturaPagamento({ pagamentoId: 5, fornitoreId: 3, numeroFattura: "55", fatturaId: 66 });

    const { updates, mismatch } = syncExpenseRowsWithPagamenti([normalRow, row], [pagamento]);

    expect(mismatch).toBe(false);
    expect(updates).toHaveLength(1);
    expect(updates[0].row).toBe(row);
  });

  it("segnala mismatch senza aggiornamenti parziali quando una riga con numero non trova il pagamento", () => {
    const rowOk = makeFatturaRow({ fornitoreId: 1, invoiceNumber: "10" });
    const rowOrfana = makeDdtRow({ fornitoreId: 2, ddtNumber: "999" });
    const pagamento = makeFatturaPagamento({ pagamentoId: 1, fornitoreId: 1, numeroFattura: "10", fatturaId: 11 });

    const { updates, mismatch } = syncExpenseRowsWithPagamenti([rowOk, rowOrfana], [pagamento]);

    expect(mismatch).toBe(true);
    expect(updates).toHaveLength(0);
  });

  it("segnala mismatch quando il server restituisce pagamenti non abbinabili alle righe", () => {
    const row = makeFatturaRow({ fornitoreId: 1, invoiceNumber: "10" });
    const pagamento = makeFatturaPagamento({ pagamentoId: 1, fornitoreId: 1, numeroFattura: "10", fatturaId: 11 });
    const pagamentoExtra = makeDdtPagamento({ pagamentoId: 2, fornitoreId: 9, numeroDdt: "777", ddtId: 88 });

    const { updates, mismatch } = syncExpenseRowsWithPagamenti([row], [pagamento, pagamentoExtra]);

    expect(mismatch).toBe(true);
    expect(updates).toHaveLength(0);
  });

  it("segnala mismatch quando un pagamento server non ha né fattura né DDT", () => {
    const row = makeFatturaRow();
    const pagamentoSenzaDocumento: PagamentoFornitoreRegistro = { pagamentoId: 1, importo: 100 };

    const { updates, mismatch } = syncExpenseRowsWithPagamenti([row], [pagamentoSenzaDocumento]);

    expect(mismatch).toBe(true);
    expect(updates).toHaveLength(0);
  });

  it("non muta le righe in input", () => {
    const row = makeDdtRow({ fornitoreId: 5, ddtNumber: "123" });
    const snapshot = { ...row };
    const pagamento = makeDdtPagamento({ pagamentoId: 77, fornitoreId: 5, numeroDdt: "123", ddtId: 33 });

    syncExpenseRowsWithPagamenti([row], [pagamento]);

    expect(row).toEqual(snapshot);
  });
});
