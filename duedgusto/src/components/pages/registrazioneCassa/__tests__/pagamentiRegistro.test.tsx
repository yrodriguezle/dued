import { describe, expect, it } from "vitest";
import { buildPagamentiInput, buildPagamentoRows, isRigaPagamentoLibero } from "../pagamentiRegistro";

const pagamentoLibero = (over: Partial<PagamentoFornitoreRegistro> = {}): PagamentoFornitoreRegistro => ({
  pagamentoId: 260,
  importo: 932,
  metodoPagamento: "Bonifico",
  categoria: "Affitto",
  descrizione: "Canone Affitto",
  ...over,
});

const pagamentoDdt: PagamentoFornitoreRegistro = {
  pagamentoId: 7,
  importo: 120,
  metodoPagamento: "Contanti",
  ddt: { ddtId: 11, numeroDdt: "D-1", fornitore: { fornitoreId: 3, ragioneSociale: "Rossi Srl", aliquotaIva: 22 } },
};

describe("buildPagamentoRows", () => {
  it("carica il pagamento libero come riga con causale, importo, metodo e categoria", () => {
    const [riga] = buildPagamentoRows([pagamentoLibero()]);

    expect(riga).toMatchObject({
      description: "Canone Affitto",
      amount: 932,
      isPagamentoFornitore: true,
      pagamentoId: 260,
      paymentMethod: "Bonifico",
      categoria: "Affitto",
    });
    expect(riga.fornitoreId).toBeUndefined();
  });

  it("usa la nota se la causale manca (righe scritte prima della separazione dei campi)", () => {
    const [riga] = buildPagamentoRows([pagamentoLibero({ descrizione: null, note: "Bolletta luce" })]);

    expect(riga.description).toBe("Bolletta luce");
  });

  it("lascia invariata la riga dei pagamenti con documento", () => {
    const [riga] = buildPagamentoRows([pagamentoDdt]);

    expect(riga).toMatchObject({ description: "Pagamento Rossi Srl - DDT D-1", fornitoreId: 3, ddtId: 11, documentType: "DDT", pagamentoId: 7 });
  });
});

describe("buildPagamentiInput", () => {
  it("rimanda al backend i pagamenti liberi caricati (altrimenti il salvataggio li cancella)", () => {
    const righe = buildPagamentoRows([pagamentoLibero(), pagamentoDdt]);

    const input = buildPagamentiInput(righe);

    expect(input).toHaveLength(2);
    expect(input[0]).toMatchObject({ pagamentoId: 260, importo: 932, metodoPagamento: "Bonifico", categoria: "Affitto", descrizione: "Canone Affitto" });
    expect(input[0].fornitoreId).toBeUndefined();
    expect(input[1]).toMatchObject({ pagamentoId: 7, fornitoreId: 3, ddtId: 11, tipoDocumento: "DDT", numeroDdt: "D-1" });
  });

  it("ignora le spese normali e le righe fornitore ancora senza fornitore", () => {
    const input = buildPagamentiInput([
      { description: "GIORNALE", amount: 4 },
      { description: "Nuova riga", amount: 10, isPagamentoFornitore: true },
    ]);

    expect(input).toEqual([]);
  });
});

describe("isRigaPagamentoLibero", () => {
  it("riconosce solo i pagamenti salvati senza fornitore", () => {
    const [libero, documentale] = buildPagamentoRows([pagamentoLibero(), pagamentoDdt]);

    expect(isRigaPagamentoLibero(libero)).toBe(true);
    expect(isRigaPagamentoLibero(documentale)).toBe(false);
    // Riga fornitore appena aggiunta in griglia: ancora modificabile.
    expect(isRigaPagamentoLibero({ description: "Nuova", amount: 1, isPagamentoFornitore: true })).toBe(false);
  });
});
