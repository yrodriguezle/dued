import { describe, it, expect } from "vitest";
import dayjs from "dayjs";

import {
  TUTTI,
  anniDisponibili,
  filtraGiorniNonLavorativi,
  aggregaGiorniNonLavorativi,
  contaGiorniIntervallo,
  motivoLabelMap,
  RigaGiorniNonLavorativi,
} from "../aggregaGiorniNonLavorativi";

const ANNO_RIFERIMENTO = 2026;

let prossimoId = 1;

function giorno(
  data: string,
  descrizione = "Ferie estive",
  codiceMotivo = "FERIE",
  ricorrente = false,
): GiornoNonLavorativo {
  return {
    giornoId: prossimoId++,
    data,
    descrizione,
    codiceMotivo,
    ricorrente,
    settingsId: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const padri = (righe: RigaGiorniNonLavorativi[]) => righe.filter((r) => r.tipoRiga === "intervallo");
const radici = (righe: RigaGiorniNonLavorativi[]) => righe.filter((r) => r.parentRowId === null);

describe("contaGiorniIntervallo", () => {
  it("conta gli estremi inclusi", () => {
    expect(contaGiorniIntervallo("2026-08-10", "2026-08-23")).toBe(14);
  });

  it("restituisce 1 sullo stesso giorno", () => {
    expect(contaGiorniIntervallo("2026-08-10", "2026-08-10")).toBe(1);
  });

  it("restituisce 0 se la fine precede l'inizio", () => {
    expect(contaGiorniIntervallo("2026-08-10", "2026-08-09")).toBe(0);
  });

  it("restituisce 0 su date non valide", () => {
    expect(contaGiorniIntervallo("", "2026-08-10")).toBe(0);
  });
});

describe("anniDisponibili", () => {
  it("restituisce gli anni dei non ricorrenti dal più recente", () => {
    const giorni = [giorno("2024-12-25"), giorno("2026-08-10"), giorno("2025-01-06")];

    expect(anniDisponibili(giorni)).toEqual([2026, 2025, 2024]);
  });

  it("ignora i ricorrenti", () => {
    const giorni = [giorno("2019-12-25", "Natale", "FESTIVITA_NAZIONALE", true), giorno("2026-08-10")];

    expect(anniDisponibili(giorni)).toEqual([2026]);
  });

  it("include sempre l'anno corrente anche senza giorni", () => {
    expect(anniDisponibili([])).toEqual([dayjs().year()]);
  });
});

describe("filtraGiorniNonLavorativi", () => {
  const giorni = [
    giorno("2026-08-10"),
    giorno("2025-08-10"),
    giorno("2019-12-25", "Natale", "FESTIVITA_NAZIONALE", true),
    giorno("2026-11-02", "Ristrutturazione", "CHIUSURA_STRAORDINARIA"),
  ];

  it("tiene l'anno selezionato più tutti i ricorrenti", () => {
    const risultato = filtraGiorniNonLavorativi(giorni, 2026, TUTTI);

    expect(risultato.map((g) => g.data)).toEqual(["2026-08-10", "2019-12-25", "2026-11-02"]);
  });

  it("con anno TUTTI non scarta nulla", () => {
    expect(filtraGiorniNonLavorativi(giorni, TUTTI, TUTTI)).toHaveLength(4);
  });

  it("filtra per motivo, ricorrenti inclusi", () => {
    const risultato = filtraGiorniNonLavorativi(giorni, TUTTI, "FESTIVITA_NAZIONALE");

    expect(risultato.map((g) => g.data)).toEqual(["2019-12-25"]);
  });

  it("combina anno e motivo", () => {
    const risultato = filtraGiorniNonLavorativi(giorni, 2026, "CHIUSURA_STRAORDINARIA");

    expect(risultato.map((g) => g.data)).toEqual(["2026-11-02"]);
  });
});

describe("aggregaGiorniNonLavorativi", () => {
  it("restituisce un array vuoto senza giorni", () => {
    expect(aggregaGiorniNonLavorativi([], ANNO_RIFERIMENTO)).toEqual([]);
  });

  it("lascia un giorno isolato come foglia di primo livello", () => {
    const righe = aggregaGiorniNonLavorativi([giorno("2026-08-15", "Ferragosto", "FESTIVITA_NAZIONALE")], ANNO_RIFERIMENTO);

    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({
      tipoRiga: "giorno",
      parentRowId: null,
      numeroGiorni: 1,
      periodo: "15/08/2026",
      motivo: motivoLabelMap.FESTIVITA_NAZIONALE,
    });
  });

  it("collassa i giorni consecutivi in un intervallo con le sue foglie", () => {
    const giorni = [giorno("2026-08-10"), giorno("2026-08-11"), giorno("2026-08-12")];

    const righe = aggregaGiorniNonLavorativi(giorni, ANNO_RIFERIMENTO);

    expect(righe).toHaveLength(4);
    expect(righe[0]).toMatchObject({
      tipoRiga: "intervallo",
      parentRowId: null,
      numeroGiorni: 3,
      data: "2026-08-10",
      dataFine: "2026-08-12",
      periodo: "10/08/2026 – 12/08/2026 · 3 giorni",
      giornoId: null,
    });
    expect(righe.slice(1).every((r) => r.parentRowId === righe[0].rowId)).toBe(true);
    expect(righe[0].giorniIds).toEqual(giorni.map((g) => g.giornoId));
  });

  it("spezza l'intervallo quando c'è un buco nella sequenza", () => {
    const righe = aggregaGiorniNonLavorativi([giorno("2026-08-10"), giorno("2026-08-11"), giorno("2026-08-13")], ANNO_RIFERIMENTO);

    expect(radici(righe)).toHaveLength(2);
    expect(padri(righe)[0]).toMatchObject({ numeroGiorni: 2, dataFine: "2026-08-11" });
    expect(radici(righe)[1]).toMatchObject({ tipoRiga: "giorno", data: "2026-08-13" });
  });

  it("non fonde giorni consecutivi con descrizione diversa", () => {
    const righe = aggregaGiorniNonLavorativi([giorno("2026-08-10", "Ferie"), giorno("2026-08-11", "Chiusura")], ANNO_RIFERIMENTO);

    expect(padri(righe)).toHaveLength(0);
    expect(radici(righe)).toHaveLength(2);
  });

  it("non fonde giorni consecutivi con motivo diverso", () => {
    const righe = aggregaGiorniNonLavorativi(
      [giorno("2026-08-10", "Chiusura", "FERIE"), giorno("2026-08-11", "Chiusura", "CHIUSURA_STRAORDINARIA")],
      ANNO_RIFERIMENTO,
    );

    expect(padri(righe)).toHaveLength(0);
  });

  it("non fonde giorni consecutivi con flag ricorrente diverso", () => {
    const righe = aggregaGiorniNonLavorativi(
      [
        giorno("2026-12-24", "Natale", "FESTIVITA_NAZIONALE", true),
        giorno("2026-12-25", "Natale", "FESTIVITA_NAZIONALE", false),
      ],
      ANNO_RIFERIMENTO,
    );

    expect(padri(righe)).toHaveLength(0);
    expect(radici(righe)).toHaveLength(2);
  });

  it("ordina anche con input disordinato", () => {
    const righe = aggregaGiorniNonLavorativi(
      [giorno("2026-08-12"), giorno("2026-08-10"), giorno("2026-08-11")],
      ANNO_RIFERIMENTO,
    );

    expect(righe[0]).toMatchObject({ tipoRiga: "intervallo", data: "2026-08-10", dataFine: "2026-08-12" });
    expect(righe.slice(1).map((r) => r.data)).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });

  it("unisce un intervallo a cavallo di due mesi", () => {
    const righe = aggregaGiorniNonLavorativi([giorno("2026-08-31"), giorno("2026-09-01")], ANNO_RIFERIMENTO);

    expect(padri(righe)).toHaveLength(1);
    expect(padri(righe)[0]).toMatchObject({ numeroGiorni: 2, periodo: "31/08/2026 – 01/09/2026 · 2 giorni" });
  });

  it("unisce un intervallo che attraversa il 29 febbraio", () => {
    const righe = aggregaGiorniNonLavorativi([giorno("2028-02-28"), giorno("2028-02-29"), giorno("2028-03-01")], 2028);

    expect(padri(righe)[0]).toMatchObject({ numeroGiorni: 3, dataFine: "2028-03-01" });
  });

  it("unisce un intervallo a cavallo di capodanno (filtro anno TUTTI)", () => {
    const righe = aggregaGiorniNonLavorativi([giorno("2026-12-31"), giorno("2027-01-01")], ANNO_RIFERIMENTO);

    expect(padri(righe)[0]).toMatchObject({ numeroGiorni: 2, data: "2026-12-31", dataFine: "2027-01-01" });
  });

  it("raggruppa ricorrenti salvati in anni diversi proiettandoli sull'anno di riferimento", () => {
    const righe = aggregaGiorniNonLavorativi(
      [
        giorno("2019-12-24", "Natale", "FESTIVITA_NAZIONALE", true),
        giorno("2026-12-25", "Natale", "FESTIVITA_NAZIONALE", true),
      ],
      ANNO_RIFERIMENTO,
    );

    expect(padri(righe)).toHaveLength(1);
    expect(padri(righe)[0]).toMatchObject({ numeroGiorni: 2, periodo: "24/12 – 25/12 · 2 giorni", anno: null });
  });

  it("ordina i ricorrenti insieme ai giorni dell'anno di riferimento", () => {
    const righe = aggregaGiorniNonLavorativi(
      [giorno("2026-03-01", "Chiusura marzo"), giorno("2019-01-06", "Epifania", "FESTIVITA_NAZIONALE", true)],
      ANNO_RIFERIMENTO,
    );

    expect(righe.map((r) => r.descrizione)).toEqual(["Epifania", "Chiusura marzo"]);
  });

  it("produce rowId univoci e stabili fra chiamate ripetute", () => {
    const giorni = [giorno("2026-08-10"), giorno("2026-08-11"), giorno("2026-08-15", "Ferragosto", "FESTIVITA_NAZIONALE")];

    const prima = aggregaGiorniNonLavorativi(giorni, ANNO_RIFERIMENTO);
    const seconda = aggregaGiorniNonLavorativi([...giorni].reverse(), ANNO_RIFERIMENTO);

    const ids = prima.map((r) => r.rowId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(seconda.map((r) => r.rowId)).toEqual(ids);
  });

  it("gli id del padre sono l'unione esatta di quelli dei figli", () => {
    const giorni = [giorno("2026-08-10"), giorno("2026-08-11"), giorno("2026-08-12")];

    const righe = aggregaGiorniNonLavorativi(giorni, ANNO_RIFERIMENTO);
    const padre = padri(righe)[0];
    const figli = righe.filter((r) => r.parentRowId === padre.rowId);

    expect(padre.giorniIds).toEqual(figli.flatMap((f) => f.giorniIds));
  });
});
