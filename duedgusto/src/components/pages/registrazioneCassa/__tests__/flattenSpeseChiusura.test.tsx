import { describe, it, expect } from "vitest";
import flattenSpeseChiusura from "../flattenSpeseChiusura";

// flattenSpeseChiusura appiattisce `registriInclusi[].registro.{spese, pagamentiFornitori}`
// in righe della griglia spese (SpeseGridRow), instradando la `data` di ogni riga al
// giorno del registro e distinguendo le righe editabili (registro leggero DRAFT senza
// apertura/chiusura → registroCassaId=null) dai pagamenti origine-cassa read-only
// (registro operativo → registroCassaId valorizzato).

// ── Helper per costruire dati mock ─────────────────────────────────────────

function makeRegistro(overrides: Record<string, unknown> = {}) {
  return {
    __typename: "RegistroCassaMensile",
    chiusuraId: 1,
    registroId: (overrides.id as number) ?? 10,
    incluso: true,
    registro: {
      __typename: "RegistroCassa",
      id: (overrides.id as number) ?? 10,
      data: "2026-05-04",
      totaleVendite: 0,
      incassoContanteTracciato: 0,
      incassiElettronici: 0,
      incassiFattura: 0,
      differenza: 0,
      stato: "DRAFT",
      totaleApertura: 0,
      totaleChiusura: 0,
      speseFornitori: 0,
      speseGiornaliere: 0,
      spese: [],
      pagamentiFornitori: [],
      ...overrides,
    },
  };
}

function makeSpesa(overrides: Record<string, unknown> = {}) {
  return {
    __typename: "SpesaCassa",
    id: 100,
    registroCassaId: 10,
    descrizione: "Affitto locale",
    importo: 500,
    categoria: "Affitto",
    ...overrides,
  };
}

function makePagamentoConFattura(overrides: Record<string, unknown> = {}) {
  return {
    pagamentoId: 200,
    dataPagamento: "2026-05-04",
    importo: 122,
    categoria: "Altro",
    metodoPagamento: "CONTANTI",
    fatturaId: 300,
    ddtId: null,
    registroCassaId: 10,
    fattura: {
      fatturaId: 300,
      numeroFattura: "FT-42",
      dataFattura: "2026-05-01",
      imponibile: 100,
      totaleConIva: 122,
      stato: "APERTA",
      fornitore: {
        fornitoreId: 7,
        ragioneSociale: "ACME S.r.l.",
        aliquotaIva: 22,
      },
    },
    ...overrides,
  };
}

// Cast unico verso il tipo globale RegistroCassaMensile[] usato dalla funzione.
const asRegistri = (arr: unknown[]) => arr as unknown as RegistroCassaMensile[];

// ── Test ────────────────────────────────────────────────────────────────

describe("flattenSpeseChiusura", () => {
  it("mappa una spesa libera in SpeseGridRow con data del registro, spesaId e categoria", () => {
    const registri = asRegistri([makeRegistro({ spese: [makeSpesa()] })]);

    const rows = flattenSpeseChiusura(registri);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: "Affitto locale",
      amount: 500,
      categoria: "Affitto",
      spesaId: 100,
      data: "2026-05-04",
    });
    // Una spesa libera NON è un pagamento fornitore.
    expect(rows[0].isPagamentoFornitore).toBeUndefined();
  });

  it("formatta la data del registro in YYYY-MM-DD anche partendo da un timestamp ISO", () => {
    const registri = asRegistri([makeRegistro({ data: "2026-05-04T10:30:00.000Z", spese: [makeSpesa()] })]);

    const rows = flattenSpeseChiusura(registri);

    expect(rows[0].data).toBe("2026-05-04");
  });

  it("mappa un pagamento CON fattura costruendo descrizione, fornitore, aliquota e id documento", () => {
    const registri = asRegistri([makeRegistro({ pagamentiFornitori: [makePagamentoConFattura()] })]);

    const rows = flattenSpeseChiusura(registri);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: "Pagamento ACME S.r.l. - FA FT-42",
      amount: 122,
      isPagamentoFornitore: true,
      fornitoreId: 7,
      documentType: "FA",
      invoiceNumber: "FT-42",
      pagamentoId: 200,
      fatturaId: 300,
      dataFattura: "2026-05-01",
      paymentMethod: "CONTANTI",
      aliquotaIva: 22,
      categoria: "Altro",
      data: "2026-05-04",
    });
  });

  it("usa un fallback descrizione per un pagamento SENZA fattura", () => {
    const pagamentoSenzaFattura = makePagamentoConFattura({ fattura: null, fatturaId: null });
    const registri = asRegistri([makeRegistro({ pagamentiFornitori: [pagamentoSenzaFattura] })]);

    const rows = flattenSpeseChiusura(registri);

    expect(rows[0].description).toBe("Pagamento Fornitore");
    expect(rows[0].isPagamentoFornitore).toBe(true);
    expect(rows[0].fornitoreId).toBeUndefined();
  });

  it("su registro LEGGERO (DRAFT senza apertura/chiusura) il pagamento è editabile: registroCassaId=null", () => {
    const registri = asRegistri([
      makeRegistro({
        stato: "DRAFT",
        totaleApertura: 0,
        totaleChiusura: 0,
        // Il server valorizza registroCassaId, ma il registro leggero rende la riga editabile.
        pagamentiFornitori: [makePagamentoConFattura({ registroCassaId: 10 })],
      }),
    ]);

    const rows = flattenSpeseChiusura(registri);

    expect(rows[0].registroCassaId).toBeNull();
  });

  it("su registro OPERATIVO (CLOSED) il pagamento è read-only: registroCassaId conserva il valore origine", () => {
    const registri = asRegistri([
      makeRegistro({
        stato: "CLOSED",
        totaleApertura: 100,
        totaleChiusura: 400,
        pagamentiFornitori: [makePagamentoConFattura({ registroCassaId: 10 })],
      }),
    ]);

    const rows = flattenSpeseChiusura(registri);

    expect(rows[0].registroCassaId).toBe(10);
  });

  it("un registro DRAFT ma con totali di apertura/chiusura NON è leggero: pagamento read-only", () => {
    const registri = asRegistri([
      makeRegistro({
        stato: "DRAFT",
        totaleApertura: 0,
        totaleChiusura: 250, // presenza di operatività cassa → non leggero
        pagamentiFornitori: [makePagamentoConFattura({ registroCassaId: 10 })],
      }),
    ]);

    const rows = flattenSpeseChiusura(registri);

    expect(rows[0].registroCassaId).toBe(10);
  });

  it("emette prima i pagamenti e poi le spese, appiattendo più registri", () => {
    const registri = asRegistri([
      makeRegistro({
        id: 10,
        data: "2026-05-04",
        pagamentiFornitori: [makePagamentoConFattura({ pagamentoId: 200 })],
        spese: [makeSpesa({ id: 100 })],
      }),
      makeRegistro({
        id: 11,
        data: "2026-05-05",
        spese: [makeSpesa({ id: 101, descrizione: "Utenze" })],
      }),
    ]);

    const rows = flattenSpeseChiusura(registri);

    expect(rows).toHaveLength(3);
    // Registro 1: pagamento prima della spesa.
    expect(rows[0].pagamentoId).toBe(200);
    expect(rows[1].spesaId).toBe(100);
    // Registro 2: spesa con la propria data.
    expect(rows[2].spesaId).toBe(101);
    expect(rows[2].data).toBe("2026-05-05");
  });

  it("gestisce registri senza spese né pagamenti (liste assenti) restituendo nessuna riga", () => {
    const registri = asRegistri([makeRegistro({ spese: undefined, pagamentiFornitori: undefined })]);

    expect(flattenSpeseChiusura(registri)).toEqual([]);
  });
});
