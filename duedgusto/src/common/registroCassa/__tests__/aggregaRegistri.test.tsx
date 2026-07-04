import { aggregaRegistriPerMese, completaDodiciMesi, creaMeseVuoto, derivaTotali, normalizzaMeseServer } from "../aggregaRegistri";
import { ANNO_FIXTURE, attesoLuglio, attesoMarzo, attesoTotaliAnno, registriFixture, registriMarzo } from "./fixtures/registriCassaFixtures";

/**
 * Replica ESATTA del reduce monthlyStats di VistaMensile.tsx (righe 84-107):
 * riferimento normativo per la parità al centesimo delle formule.
 */
function monthlyStatsVistaMensile(cashRegisters: RegistroCassa[]) {
  return cashRegisters.reduce(
    (acc, cr: RegistroCassa) => {
      const movimentoCassa = (cr.totaleChiusura ?? 0) - (cr.totaleApertura ?? 0);
      const contanteTracciato = cr.incassoContanteTracciato ?? 0;
      const elettronici = cr.incassiElettronici ?? 0;
      const fatture = cr.incassiFattura ?? 0;
      const venditeRegistro = cr.totaleVendite ?? movimentoCassa + elettronici + fatture;
      return {
        totaleVendite: acc.totaleVendite + venditeRegistro,
        ricavoTracciato: acc.ricavoTracciato + contanteTracciato + elettronici + fatture,
        ricavoNonTracciato: acc.ricavoNonTracciato + (movimentoCassa - contanteTracciato),
        speseTracciate: acc.speseTracciate + (cr.speseFornitori || 0),
        speseNonTracciate: acc.speseNonTracciate + (cr.speseGiornaliere || 0),
        registri: acc.registri + 1,
        chiusi: acc.chiusi + (cr.stato === "CLOSED" || cr.stato === "RECONCILED" ? 1 : 0),
        bozze: acc.bozze + (cr.stato === "DRAFT" ? 1 : 0),
      };
    },
    { totaleVendite: 0, ricavoTracciato: 0, ricavoNonTracciato: 0, speseTracciate: 0, speseNonTracciate: 0, registri: 0, chiusi: 0, bozze: 0 }
  );
}

describe("aggregaRegistriPerMese", () => {
  it("restituisce sempre 12 mesi ordinati 1-12, con i mesi vuoti a zero", () => {
    const mesi = aggregaRegistriPerMese(registriFixture, ANNO_FIXTURE);

    expect(mesi).toHaveLength(12);
    expect(mesi.map((m) => m.mese)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    mesi.forEach((mese) => expect(mese.anno).toBe(ANNO_FIXTURE));

    // Gennaio (senza registri) è tutto a zero
    const gennaio = mesi[0];
    expect(gennaio.totaleVendite).toBe(0);
    expect(gennaio.registri).toBe(0);
    expect(gennaio.differenza).toBe(0);
  });

  it("calcola marzo (DRAFT inclusi) al centesimo con i valori attesi delle formule normative", () => {
    const mesi = aggregaRegistriPerMese(registriFixture, ANNO_FIXTURE);
    const marzo = mesi[2];

    expect(marzo.totaleVendite).toBeCloseTo(attesoMarzo.totaleVendite, 2);
    expect(marzo.ricavoTracciato).toBeCloseTo(attesoMarzo.ricavoTracciato, 2);
    expect(marzo.ricavoNonTracciato).toBeCloseTo(attesoMarzo.ricavoNonTracciato, 2);
    expect(marzo.speseTracciate).toBeCloseTo(attesoMarzo.speseTracciate, 2);
    expect(marzo.speseNonTracciate).toBeCloseTo(attesoMarzo.speseNonTracciate, 2);
    expect(marzo.incassoContanteTracciato).toBeCloseTo(attesoMarzo.incassoContanteTracciato, 2);
    expect(marzo.incassiElettronici).toBeCloseTo(attesoMarzo.incassiElettronici, 2);
    expect(marzo.incassiFattura).toBeCloseTo(attesoMarzo.incassiFattura, 2);
    expect(marzo.totaleSpese).toBeCloseTo(attesoMarzo.totaleSpese, 2);
    expect(marzo.differenza).toBeCloseTo(attesoMarzo.differenza, 2);
    expect(marzo.registri).toBe(attesoMarzo.registri);
    expect(marzo.chiusi).toBe(attesoMarzo.chiusi);
    expect(marzo.bozze).toBe(attesoMarzo.bozze);
  });

  it("è in parità al centesimo con il reduce monthlyStats di VistaMensile per lo stesso mese", () => {
    const marzo = aggregaRegistriPerMese(registriFixture, ANNO_FIXTURE)[2];
    const riferimento = monthlyStatsVistaMensile(registriMarzo);

    expect(marzo.totaleVendite).toBeCloseTo(riferimento.totaleVendite, 2);
    expect(marzo.ricavoTracciato).toBeCloseTo(riferimento.ricavoTracciato, 2);
    expect(marzo.ricavoNonTracciato).toBeCloseTo(riferimento.ricavoNonTracciato, 2);
    expect(marzo.speseTracciate).toBeCloseTo(riferimento.speseTracciate, 2);
    expect(marzo.speseNonTracciate).toBeCloseTo(riferimento.speseNonTracciate, 2);
    expect(marzo.registri).toBe(riferimento.registri);
    expect(marzo.chiusi).toBe(riferimento.chiusi);
    expect(marzo.bozze).toBe(riferimento.bozze);
  });

  it("gestisce i campi null come 0 senza produrre NaN", () => {
    const mesi = aggregaRegistriPerMese(registriFixture, ANNO_FIXTURE);

    mesi.forEach((mese) => {
      Object.values(mese).forEach((valore) => {
        expect(Number.isFinite(valore as number)).toBe(true);
      });
    });
  });

  it("mantiene il ricavo non tracciato negativo (nessun clamp nelle formule)", () => {
    const luglio = aggregaRegistriPerMese(registriFixture, ANNO_FIXTURE)[6];

    expect(luglio.ricavoNonTracciato).toBeCloseTo(attesoLuglio.ricavoNonTracciato, 2);
    expect(luglio.differenza).toBeCloseTo(attesoLuglio.differenza, 2);
    expect(luglio.chiusi).toBe(attesoLuglio.chiusi);
  });

  it("esclude i registri di anni diversi da quello richiesto", () => {
    const mesi = aggregaRegistriPerMese(registriFixture, ANNO_FIXTURE);
    const maggio = mesi[4]; // il registro 2025-05 non deve contare

    expect(maggio.registri).toBe(0);
    expect(maggio.totaleVendite).toBe(0);

    const totali = derivaTotali(mesi);
    expect(totali.registri).toBe(attesoTotaliAnno.registri);
  });

  it("restituisce 12 mesi a zero per un anno senza registri", () => {
    const mesi = aggregaRegistriPerMese([], ANNO_FIXTURE);

    expect(mesi).toHaveLength(12);
    mesi.forEach((mese) => {
      expect(mese.totaleVendite).toBe(0);
      expect(mese.registri).toBe(0);
    });
  });
});

describe("derivaTotali", () => {
  it("somma i 12 mesi e ricalcola i derivati (totaleSpese, differenza)", () => {
    const mesi = aggregaRegistriPerMese(registriFixture, ANNO_FIXTURE);
    const totali = derivaTotali(mesi);

    expect(totali.totaleVendite).toBeCloseTo(attesoTotaliAnno.totaleVendite, 2);
    expect(totali.ricavoTracciato).toBeCloseTo(attesoTotaliAnno.ricavoTracciato, 2);
    expect(totali.ricavoNonTracciato).toBeCloseTo(attesoTotaliAnno.ricavoNonTracciato, 2);
    expect(totali.speseTracciate).toBeCloseTo(attesoTotaliAnno.speseTracciate, 2);
    expect(totali.speseNonTracciate).toBeCloseTo(attesoTotaliAnno.speseNonTracciate, 2);
    expect(totali.totaleSpese).toBeCloseTo(attesoTotaliAnno.totaleSpese, 2);
    expect(totali.differenza).toBeCloseTo(attesoTotaliAnno.differenza, 2);
    expect(totali.registri).toBe(attesoTotaliAnno.registri);
    expect(totali.chiusi).toBe(attesoTotaliAnno.chiusi);
    expect(totali.bozze).toBe(attesoTotaliAnno.bozze);
  });

  it("restituisce tutti zeri per un array vuoto", () => {
    const totali = derivaTotali([]);

    expect(totali.totaleVendite).toBe(0);
    expect(totali.totaleSpese).toBe(0);
    expect(totali.differenza).toBe(0);
    expect(totali.registri).toBe(0);
  });
});

describe("completaDodiciMesi", () => {
  it("riempie i mesi mancanti con riepiloghi a zero mantenendo quelli presenti", () => {
    const soloMarzo = { ...creaMeseVuoto(ANNO_FIXTURE, 3), totaleVendite: 100, registri: 1, differenza: 100 };
    const mesi = completaDodiciMesi(ANNO_FIXTURE, [soloMarzo]);

    expect(mesi).toHaveLength(12);
    expect(mesi[2].totaleVendite).toBe(100);
    expect(mesi[0].totaleVendite).toBe(0);
    expect(mesi[11].totaleVendite).toBe(0);
  });
});

describe("normalizzaMeseServer", () => {
  it("aggiunge i derivati client (totaleSpese, differenza) al payload server", () => {
    const meseServer: RiepilogoMeseCassaServer = {
      __typename: "RiepilogoMeseCassa",
      anno: ANNO_FIXTURE,
      mese: 3,
      totaleVendite: 930.7,
      ricavoTracciato: 580.4,
      ricavoNonTracciato: 350.3,
      speseTracciate: 30.3,
      speseNonTracciate: 35.2,
      incassoContanteTracciato: 300.1,
      incassiElettronici: 230.25,
      incassiFattura: 50.05,
      registri: 3,
      chiusi: 2,
      bozze: 1,
    };

    const normalizzato = normalizzaMeseServer(meseServer);

    expect(normalizzato.totaleSpese).toBeCloseTo(65.5, 2);
    expect(normalizzato.differenza).toBeCloseTo(865.2, 2);
    expect(normalizzato.totaleVendite).toBeCloseTo(930.7, 2);
  });

  it("tratta i campi null/undefined come 0 senza NaN", () => {
    const meseServer = { anno: ANNO_FIXTURE, mese: 1 } as RiepilogoMeseCassaServer;

    const normalizzato = normalizzaMeseServer(meseServer);

    Object.values(normalizzato).forEach((valore) => {
      expect(Number.isFinite(valore as number)).toBe(true);
    });
    expect(normalizzato.totaleSpese).toBe(0);
    expect(normalizzato.differenza).toBe(0);
  });
});
