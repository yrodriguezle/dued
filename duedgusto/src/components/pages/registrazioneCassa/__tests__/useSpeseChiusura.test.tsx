import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMutation } from "@apollo/client";

import useSpeseChiusura from "../useSpeseChiusura";
import {
  mutationAggiungiSpesaCassaSuGiorno,
  mutationAggiornaSpesaCassaSuGiorno,
  mutationEliminaSpesaCassaSuGiorno,
  mutationAggiungiPagamentoFornitoreSuGiorno,
  mutationAggiornaPagamentoFornitoreSuGiorno,
  mutationEliminaPagamentoFornitoreSuGiorno,
} from "../../../../graphql/chiusureMensili/speseMutations";
import { SpeseGridRow } from "../SpeseDataGrid";

// useSpeseChiusura mappa i 6 callback di SpeseDataGridPersistence sulle mutation
// `*SuGiorno`, instradando ogni riga al registro del giorno (row.data), restituendo
// l'id creato dal server e facendo refetch della chiusura dopo ogni operazione.
// Mockiamo `useMutation` di Apollo per catturare il documento e le variabili passate.

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return { ...actual, useMutation: vi.fn() };
});

const mockUseMutation = vi.mocked(useMutation);

// Ogni mutation-document viene associato a una mock-fn distinta così da verificare
// che il callback giusto chiami la mutation giusta.
const aggiungiSpesaFn = vi.fn(async () => ({ data: { gestioneCassa: { aggiungiSpesaCassaSuGiorno: { id: 111 } } } }));
const aggiornaSpesaFn = vi.fn(async () => ({ data: undefined }));
const eliminaSpesaFn = vi.fn(async () => ({ data: undefined }));
const aggiungiPagamentoFn = vi.fn(async () => ({ data: { gestioneCassa: { aggiungiPagamentoFornitoreSuGiorno: { pagamentoId: 222 } } } }));
const aggiornaPagamentoFn = vi.fn(async () => ({ data: undefined }));
const eliminaPagamentoFn = vi.fn(async () => ({ data: undefined }));

const fnByDoc = new Map<unknown, ReturnType<typeof vi.fn>>([
  [mutationAggiungiSpesaCassaSuGiorno, aggiungiSpesaFn],
  [mutationAggiornaSpesaCassaSuGiorno, aggiornaSpesaFn],
  [mutationEliminaSpesaCassaSuGiorno, eliminaSpesaFn],
  [mutationAggiungiPagamentoFornitoreSuGiorno, aggiungiPagamentoFn],
  [mutationAggiornaPagamentoFornitoreSuGiorno, aggiornaPagamentoFn],
  [mutationEliminaPagamentoFornitoreSuGiorno, eliminaPagamentoFn],
]);

const refetch = vi.fn(async () => undefined);

function setup() {
  mockUseMutation.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((doc: unknown) => [fnByDoc.get(doc) ?? vi.fn(async () => ({ data: undefined })), { loading: false }]) as any
  );
  const { result } = renderHook(() => useSpeseChiusura({ refetch }));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSpeseChiusura", () => {
  it("createExpense chiama aggiungiSpesaCassaSuGiorno col payload della riga, fa refetch e ritorna l'id creato", async () => {
    const result = setup();
    const row: SpeseGridRow = { description: "Affitto", amount: 500, categoria: "Affitto", data: "2026-05-04" };

    const newId = await result.current.createExpense(row);

    expect(aggiungiSpesaFn).toHaveBeenCalledWith({
      variables: { input: { data: "2026-05-04", descrizione: "Affitto", importo: 500, categoria: "Affitto" } },
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(newId).toBe(111);
  });

  it("createExpense usa categoria di default 'Altro' quando assente", async () => {
    const result = setup();
    const row: SpeseGridRow = { description: "Varie", amount: 10, data: "2026-05-04" };

    await result.current.createExpense(row);

    expect(aggiungiSpesaFn).toHaveBeenCalledWith({
      variables: { input: { data: "2026-05-04", descrizione: "Varie", importo: 10, categoria: "Altro" } },
    });
  });

  it("updateExpense chiama aggiornaSpesaCassaSuGiorno con spesaId+data e fa refetch", async () => {
    const result = setup();
    const row: SpeseGridRow = { description: "Affitto", amount: 550, categoria: "Affitto", data: "2026-05-06", spesaId: 5 };

    await result.current.updateExpense(row);

    expect(aggiornaSpesaFn).toHaveBeenCalledWith({
      variables: { input: { spesaId: 5, data: "2026-05-06", descrizione: "Affitto", importo: 550, categoria: "Affitto" } },
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("updateExpense NON chiama la mutation per righe non salvate (spesaId <= 0)", async () => {
    const result = setup();
    await result.current.updateExpense({ description: "Nuova", amount: 1, spesaId: -1, data: "2026-05-06" });

    expect(aggiornaSpesaFn).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("deleteExpense chiama eliminaSpesaCassaSuGiorno con lo spesaId e fa refetch", async () => {
    const result = setup();
    await result.current.deleteExpense({ description: "x", amount: 1, spesaId: 9, data: "2026-05-06" });

    expect(eliminaSpesaFn).toHaveBeenCalledWith({ variables: { spesaId: 9 } });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("deleteExpense NON chiama la mutation per righe non salvate (spesaId <= 0)", async () => {
    const result = setup();
    await result.current.deleteExpense({ description: "x", amount: 1, spesaId: -1, data: "2026-05-06" });

    expect(eliminaSpesaFn).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("createSupplierPayment instrada la riga CON fattura, fa refetch e ritorna il pagamentoId creato", async () => {
    const result = setup();
    const row: SpeseGridRow = {
      description: "Pagamento ACME",
      amount: 122,
      data: "2026-05-04",
      isPagamentoFornitore: true,
      fornitoreId: 7,
      invoiceNumber: "FT-42",
      dataFattura: "2026-05-01",
      aliquotaIva: 22,
      paymentMethod: "CONTANTI",
      categoria: "Altro",
    };

    const newId = await result.current.createSupplierPayment(row);

    expect(aggiungiPagamentoFn).toHaveBeenCalledWith({
      variables: {
        input: {
          data: "2026-05-04",
          importo: 122,
          metodoPagamento: "CONTANTI",
          categoria: "Altro",
          fornitoreId: 7,
          numeroFattura: "FT-42",
          dataFattura: "2026-05-01",
          aliquotaIva: 22,
        },
      },
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(newId).toBe(222);
  });

  it("updateSupplierPayment chiama aggiornaPagamentoFornitoreSuGiorno con pagamentoId+dataPagamento e fa refetch", async () => {
    const result = setup();
    const row: SpeseGridRow = {
      description: "Pagamento ACME",
      amount: 130,
      data: "2026-05-07",
      isPagamentoFornitore: true,
      pagamentoId: 200,
      fatturaId: 300,
      paymentMethod: "CARTA",
      categoria: "Altro",
    };

    await result.current.updateSupplierPayment(row);

    expect(aggiornaPagamentoFn).toHaveBeenCalledWith({
      variables: {
        input: {
          pagamentoId: 200,
          fatturaId: 300,
          ddtId: undefined,
          dataPagamento: "2026-05-07",
          importo: 130,
          metodoPagamento: "CARTA",
          categoria: "Altro",
        },
      },
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("updateSupplierPayment NON chiama la mutation senza pagamentoId", async () => {
    const result = setup();
    await result.current.updateSupplierPayment({ description: "x", amount: 1, data: "2026-05-07", isPagamentoFornitore: true });

    expect(aggiornaPagamentoFn).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("deleteSupplierPayment chiama eliminaPagamentoFornitoreSuGiorno col pagamentoId e fa refetch", async () => {
    const result = setup();
    await result.current.deleteSupplierPayment({ description: "x", amount: 1, data: "2026-05-07", isPagamentoFornitore: true, pagamentoId: 200 });

    expect(eliminaPagamentoFn).toHaveBeenCalledWith({ variables: { pagamentoId: 200 } });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("deleteSupplierPayment NON chiama la mutation senza pagamentoId", async () => {
    const result = setup();
    await result.current.deleteSupplierPayment({ description: "x", amount: 1, data: "2026-05-07", isPagamentoFornitore: true });

    expect(eliminaPagamentoFn).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });
});
