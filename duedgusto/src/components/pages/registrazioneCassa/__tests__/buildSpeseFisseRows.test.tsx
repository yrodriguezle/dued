import { describe, it, expect } from "vitest";
import buildSpeseFisseRows, { CATEGORIE_FISSE } from "../buildSpeseFisseRows";

type SpesaMock = { id: number; descrizione: string; importo: number; categoria: CategoriaSpesa; note?: string | null; createdAt?: string; ordine?: number | null };
type PagamentoMock = {
  pagamentoId: number;
  fatturaId: number | null;
  ddtId: number | null;
  dataPagamento: string;
  importo: number;
  metodoPagamento: string | null;
  categoria: CategoriaSpesa | null;
  descrizione?: string | null;
  note: string | null;
  createdAt?: string;
  ordine?: number | null;
};

function registro(
  data: string,
  { registroId = 1, incluso = true, spese = [] as SpesaMock[], pagamenti = [] as PagamentoMock[] } = {}
) {
  return {
    chiusuraId: 1,
    registroId,
    incluso,
    registro: { id: registroId, data, spese, pagamentiFornitori: pagamenti },
  } as unknown as RegistroCassaMensile;
}

const spesa = (over: Partial<SpesaMock> = {}): SpesaMock => ({
  id: 1,
  descrizione: "Affitto",
  importo: 800,
  categoria: "Affitto",
  ...over,
});

const pagamento = (over: Partial<PagamentoMock> = {}): PagamentoMock => ({
  pagamentoId: 1,
  fatturaId: null,
  ddtId: null,
  dataPagamento: "2026-05-31",
  importo: 3000,
  metodoPagamento: "Bonifico",
  categoria: "Stipendi",
  note: "Stipendi maggio",
  ...over,
});

describe("buildSpeseFisseRows", () => {
  it("tiene solo le categorie fisse: la minuta quotidiana resta sul registro giornaliero", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", {
        spese: [
          spesa({ id: 1, categoria: "Affitto" }),
          spesa({ id: 2, categoria: "Utenze", descrizione: "Enel" }),
          spesa({ id: 3, categoria: "Altro", descrizione: "GIORNALE", importo: 3.2 }),
        ],
      }),
    ]);

    expect(righe.map((r) => r.description)).toEqual(["Affitto", "Enel"]);
    expect(CATEGORIE_FISSE).not.toContain("Altro");
  });

  it("esclude i pagamenti documentali, che hanno categoria null", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", {
        pagamenti: [
          pagamento({ pagamentoId: 1, categoria: "Stipendi" }),
          pagamento({ pagamentoId: 2, categoria: null, fatturaId: 9, note: "Fattura merce" }),
        ],
      }),
    ]);

    expect(righe).toHaveLength(1);
    expect(righe[0].pagamentoId).toBe(1);
  });

  it("esclude i registri non inclusi, la stessa base dei KPI del mese", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-10", { registroId: 1, spese: [spesa({ id: 1 })] }),
      registro("2026-05-11", { registroId: 2, incluso: false, spese: [spesa({ id: 2 })] }),
    ]);

    expect(righe).toHaveLength(1);
    expect(righe[0].spesaId).toBe(1);
  });

  it("deriva la Data dal registro genitore: SpesaCassa non ha una data propria", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", {
        spese: [spesa()],
        // Data del pagamento volutamente incoerente: vince quella del registro.
        pagamenti: [pagamento({ dataPagamento: "2026-01-01" })],
      }),
    ]);

    expect(righe.every((r) => r.data === "2026-05-31")).toBe(true);
  });

  it("marca le righe tracciate e riporta metodo di pagamento e causale", () => {
    const [riga] = buildSpeseFisseRows([
      registro("2026-05-31", { pagamenti: [pagamento()] }),
    ]);

    expect(riga.isPagamentoFornitore).toBe(true);
    expect(riga.paymentMethod).toBe("Bonifico");
    expect(riga.description).toBe("Stipendi maggio");
    expect(riga.amount).toBe(3000);
  });

  it("usa una causale di ripiego quando la nota del pagamento è vuota", () => {
    const [riga] = buildSpeseFisseRows([
      registro("2026-05-31", { pagamenti: [pagamento({ note: "   " })] }),
    ]);

    expect(riga.description).toBe("Spesa fissa tracciata (Stipendi)");
  });

  it("ordina per data in modo stabile: la griglia si ricostruisce a ogni refetch", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", { registroId: 2, spese: [spesa({ id: 9, descrizione: "Tardi" })] }),
      registro("2026-05-01", { registroId: 1, spese: [spesa({ id: 3, descrizione: "Presto" })] }),
    ]);

    expect(righe.map((r) => r.description)).toEqual(["Presto", "Tardi"]);
  });

  it("non esplode se spese e pagamenti mancano", () => {
    const righe = buildSpeseFisseRows([
      { chiusuraId: 1, registroId: 1, incluso: true, registro: { id: 1, data: "2026-05-01" } } as unknown as RegistroCassaMensile,
    ]);

    expect(righe).toEqual([]);
  });
});

describe("buildSpeseFisseRows — causale e nota sono campi distinti", () => {
  it("porta in griglia la nota di una spesa in contanti", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-06-30", {
        spese: [spesa({ id: 221, categoria: "Stipendi", descrizione: "Stipendio Dore", importo: 700, note: "+300 dallo stipendio di Doris" })],
      }),
    ]);

    expect(righe[0].description).toBe("Stipendio Dore");
    expect(righe[0].note).toBe("+300 dallo stipendio di Doris");
  });

  it("su un pagamento tracciato legge la causale da descrizione e tiene la nota separata", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-06-30", {
        pagamenti: [
          pagamento({ pagamentoId: 128, categoria: "Stipendi", descrizione: "Stipendio Doris", note: "-300 versati a Dore" }),
        ],
      }),
    ]);

    expect(righe[0].description).toBe("Stipendio Doris");
    expect(righe[0].note).toBe("-300 versati a Dore");
  });

  // Retrocompatibilita: prima della separazione dei campi la causale stava in `note`.
  // Le righe non ancora migrate devono continuare a mostrarla come causale, e NON
  // devono comparire come se avessero una nota.
  it("su una riga non migrata usa note come causale e lascia la nota vuota", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-06-30", {
        pagamenti: [pagamento({ pagamentoId: 133, categoria: "Affitto", descrizione: null, note: "affito" })],
      }),
    ]);

    expect(righe[0].description).toBe("affito");
    expect(righe[0].note).toBeUndefined();
  });

  it("senza causale ne nota ricade sull'etichetta generica", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-06-30", {
        pagamenti: [pagamento({ pagamentoId: 140, categoria: "Utenze", descrizione: null, note: null })],
      }),
    ]);

    expect(righe[0].description).toBe("Spesa fissa tracciata (Utenze)");
    expect(righe[0].note).toBeUndefined();
  });

  it("a parità di giorno segue l'ordine di inserimento, anche fra spese e pagamenti", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", {
        spese: [
          spesa({ id: 2, descrizione: "Luce", createdAt: "2026-05-31T10:00:02.000Z" }),
        ],
        pagamenti: [
          pagamento({ pagamentoId: 9, descrizione: "Stipendio A", createdAt: "2026-05-31T10:00:01.000Z" }),
          pagamento({ pagamentoId: 1, descrizione: "Stipendio B", createdAt: "2026-05-31T10:00:03.000Z" }),
        ],
      }),
    ]);

    // Prima il pagamento inserito per primo, poi la spesa, poi l'ultimo pagamento:
    // né il tipo di riga né l'id (tabelle diverse) decidono la posizione.
    expect(righe.map((r) => r.description)).toEqual(["Stipendio A", "Luce", "Stipendio B"]);
  });

  it("righe inserite nello stesso secondo si ordinano ai millisecondi", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", {
        spese: [spesa({ id: 1, descrizione: "Seconda", createdAt: "2026-05-31T10:00:00.900Z" })],
        pagamenti: [pagamento({ pagamentoId: 5, descrizione: "Prima", createdAt: "2026-05-31T10:00:00.100Z" })],
      }),
    ]);
    expect(righe.map((r) => r.description)).toEqual(["Prima", "Seconda"]);
  });

  it("il giorno resta il primo criterio, prima dell'istante di inserimento", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", { registroId: 2, spese: [spesa({ id: 1, descrizione: "Fine mese", createdAt: "2026-05-01T08:00:00.000Z" })] }),
      registro("2026-05-02", { registroId: 1, spese: [spesa({ id: 2, descrizione: "Inizio mese", createdAt: "2026-05-20T08:00:00.000Z" })] }),
    ]);
    expect(righe.map((r) => r.description)).toEqual(["Inizio mese", "Fine mese"]);
  });

  it("la posizione scelta trascinando batte l'ordine di inserimento; le righe mai riordinate vengono dopo", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", {
        spese: [
          spesa({ id: 1, descrizione: "Vecchia, riordinata terza", createdAt: "2026-05-31T08:00:00.000Z", ordine: 3 }),
          spesa({ id: 2, descrizione: "Nuova mai riordinata", createdAt: "2026-05-31T12:00:00.000Z", ordine: null }),
        ],
        pagamenti: [
          pagamento({ pagamentoId: 7, descrizione: "Tracciata, riordinata prima", createdAt: "2026-05-31T11:00:00.000Z", ordine: 1 }),
          pagamento({ pagamentoId: 8, descrizione: "Tracciata, riordinata seconda", createdAt: "2026-05-31T09:00:00.000Z", ordine: 2 }),
        ],
      }),
    ]);

    expect(righe.map((r) => r.description)).toEqual([
      "Tracciata, riordinata prima",
      "Tracciata, riordinata seconda",
      "Vecchia, riordinata terza",
      "Nuova mai riordinata",
    ]);
  });

  it("l'ordine scelto vale dentro il giorno: il giorno resta il primo criterio", () => {
    const righe = buildSpeseFisseRows([
      registro("2026-05-31", { registroId: 2, spese: [spesa({ id: 1, descrizione: "Fine mese", ordine: 1 })] }),
      registro("2026-05-02", { registroId: 1, spese: [spesa({ id: 2, descrizione: "Inizio mese", ordine: 9 })] }),
    ]);
    expect(righe.map((r) => r.description)).toEqual(["Inizio mese", "Fine mese"]);
  });
});
