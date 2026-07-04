import { describe, it, expect } from "vitest";
import { clampaFlussoCassa, costruisciFlussoSankey, DatiSankeyFlusso } from "../flussoCassaUtils";
import { ANNO_TEST, creaMese, creaRiepilogo } from "./fixtures/riepilogoDashboardFixtures";

/** Costruisce i totali annuali dalle fixture normative condivise. */
function creaTotali(overrides: Partial<RiepilogoMeseDashboard>): RiepilogoDashboard["totaliAnno"] {
  const riepilogo = creaRiepilogo(ANNO_TEST, [creaMese(ANNO_TEST, 3, { registri: 1, ...overrides })]);
  return riepilogo.totaliAnno;
}

/** Trova un link per nome dei nodi sorgente/destinazione (indici rimappati). */
function trovaLink(dati: DatiSankeyFlusso, sorgente: string, destinazione: string) {
  return dati.links.find((link) => dati.nodes[link.source]?.name === sorgente && dati.nodes[link.target]?.name === destinazione);
}

describe("clampaFlussoCassa", () => {
  it("con flusso completo positivo conserva il flusso senza clamp (scenario spec)", () => {
    const flusso = clampaFlussoCassa(
      creaTotali({
        totaleVendite: 100000,
        ricavoTracciato: 70000,
        ricavoNonTracciato: 30000,
        speseTracciate: 20000,
        speseNonTracciate: 10000,
      })
    );

    expect(flusso.ricavoTracciato).toBe(70000);
    expect(flusso.ricavoNonTracciato).toBe(30000);
    expect(flusso.speseTracciate).toBe(20000);
    expect(flusso.speseNonTracciate).toBe(10000);
    expect(flusso.nettoTracciato).toBe(50000);
    expect(flusso.nettoNonTracciato).toBe(20000);
    // Netto = 100.000 − 30.000 di spese (scenario "Flusso completo positivo")
    expect(flusso.netto).toBe(70000);
    expect(flusso.nettoReale).toBe(70000);
    expect(flusso.nettoNegativo).toBe(false);
    expect(flusso.note).toEqual([]);
    // Conservazione: ricavi mostrati = spese mostrate + netto mostrato
    expect(flusso.ricavoTracciato + flusso.ricavoNonTracciato).toBe(flusso.speseTracciate + flusso.speseNonTracciate + flusso.netto);
  });

  it("clampa a 0 il ricavo non tracciato negativo con nota testuale", () => {
    const flusso = clampaFlussoCassa(
      creaTotali({
        totaleVendite: 200,
        ricavoTracciato: 350,
        ricavoNonTracciato: -150,
        incassoContanteTracciato: 250,
        incassiElettronici: 100,
      })
    );

    expect(flusso.ricavoNonTracciato).toBe(0);
    expect(flusso.speseNonTracciate).toBe(0);
    expect(flusso.nettoNonTracciato).toBe(0);
    expect(flusso.note.join(" ")).toContain("Ricavo non tracciato negativo (€ -150,00)");
  });

  it("sottrae dal Netto l'eccedenza di spesa oltre il ramo di provenienza", () => {
    // Tracciato 100 con spese tracciate 150: eccedenza 50 sottratta dal
    // residuo non tracciato (80 − 20 = 60 → 10). Netto = differenza reale.
    const flusso = clampaFlussoCassa(
      creaTotali({
        totaleVendite: 180,
        ricavoTracciato: 100,
        ricavoNonTracciato: 80,
        speseTracciate: 150,
        speseNonTracciate: 20,
      })
    );

    expect(flusso.speseTracciate).toBe(100); // limitata al ramo
    expect(flusso.nettoTracciato).toBe(0);
    expect(flusso.nettoNonTracciato).toBe(10);
    expect(flusso.netto).toBe(10);
    expect(flusso.nettoReale).toBe(10); // 180 − 170
    expect(flusso.note.join(" ")).toContain("eccedenza (€ 50,00)");
  });

  it("con netto negativo mostra 0 nel grafico e segnala il valore reale", () => {
    const flusso = clampaFlussoCassa(
      creaTotali({
        totaleVendite: 100,
        ricavoTracciato: 100,
        ricavoNonTracciato: 0,
        speseTracciate: 150,
        speseNonTracciate: 0,
      })
    );

    expect(flusso.netto).toBe(0);
    expect(flusso.nettoNegativo).toBe(true);
    expect(flusso.nettoReale).toBe(-50);
    expect(flusso.speseTracciate).toBe(100);
  });

  it("clampa a 0 le spese negative con nota", () => {
    const flusso = clampaFlussoCassa(
      creaTotali({
        totaleVendite: 100,
        ricavoTracciato: 100,
        speseTracciate: -30,
      })
    );

    expect(flusso.speseTracciate).toBe(0);
    expect(flusso.note.join(" ")).toContain("Spese tracciate negative (€ -30,00)");
  });
});

describe("costruisciFlussoSankey", () => {
  it("costruisce la topologia completa Vendite → rami → spese/netto", () => {
    const dati = costruisciFlussoSankey(
      clampaFlussoCassa(
        creaTotali({
          totaleVendite: 100000,
          ricavoTracciato: 70000,
          ricavoNonTracciato: 30000,
          speseTracciate: 20000,
          speseNonTracciate: 10000,
        })
      )
    );

    expect(dati.nodes.map((nodo) => nodo.name)).toEqual(["Vendite", "Ricavo tracciato", "Ricavo non tracciato", "Spese tracciate", "Spese non tracciate", "Netto"]);
    expect(dati.links).toHaveLength(6);
    expect(trovaLink(dati, "Vendite", "Ricavo tracciato")?.value).toBe(70000);
    expect(trovaLink(dati, "Vendite", "Ricavo non tracciato")?.value).toBe(30000);
    expect(trovaLink(dati, "Ricavo tracciato", "Spese tracciate")?.value).toBe(20000);
    expect(trovaLink(dati, "Ricavo tracciato", "Netto")?.value).toBe(50000);
    expect(trovaLink(dati, "Ricavo non tracciato", "Spese non tracciate")?.value).toBe(10000);
    expect(trovaLink(dati, "Ricavo non tracciato", "Netto")?.value).toBe(20000);
  });

  it("non produce MAI link con valore negativo o zero", () => {
    const dati = costruisciFlussoSankey(
      clampaFlussoCassa(
        creaTotali({
          totaleVendite: 200,
          ricavoTracciato: 350,
          ricavoNonTracciato: -150,
          speseTracciate: 400, // eccede il ramo
          speseNonTracciate: 25,
        })
      )
    );

    expect(dati.links.length).toBeGreaterThan(0);
    dati.links.forEach((link) => expect(link.value).toBeGreaterThan(0));
  });

  it("rimuove i nodi senza collegamenti e rimappa gli indici", () => {
    // Ramo non tracciato interamente negativo: i nodi "Ricavo non tracciato"
    // e "Spese non tracciate" spariscono, gli indici restano coerenti.
    const dati = costruisciFlussoSankey(
      clampaFlussoCassa(
        creaTotali({
          totaleVendite: 350,
          ricavoTracciato: 350,
          ricavoNonTracciato: -150,
          speseTracciate: 50,
          speseNonTracciate: 25,
        })
      )
    );

    const nomi = dati.nodes.map((nodo) => nodo.name);
    expect(nomi).toEqual(["Vendite", "Ricavo tracciato", "Spese tracciate", "Netto"]);
    dati.links.forEach((link) => {
      expect(dati.nodes[link.source]).toBeDefined();
      expect(dati.nodes[link.target]).toBeDefined();
    });
    // Le spese non tracciate (25) non hanno più ramo di provenienza (clampato
    // a 0): l'eccedenza è sottratta dal Netto → 350 − 50 − 25 = 275, che
    // coincide con la differenza reale (350 − 75).
    expect(trovaLink(dati, "Ricavo tracciato", "Netto")?.value).toBe(275);
  });

  it("con netto negativo nessun link raggiunge il nodo Netto", () => {
    const dati = costruisciFlussoSankey(
      clampaFlussoCassa(
        creaTotali({
          totaleVendite: 100,
          ricavoTracciato: 100,
          ricavoNonTracciato: 0,
          speseTracciate: 150,
        })
      )
    );

    expect(dati.nodes.map((nodo) => nodo.name)).not.toContain("Netto");
    expect(dati.links.every((link) => link.value > 0)).toBe(true);
  });

  it("senza alcun valore restituisce nodi e link vuoti", () => {
    const dati = costruisciFlussoSankey(clampaFlussoCassa(creaTotali({})));
    expect(dati.nodes).toEqual([]);
    expect(dati.links).toEqual([]);
  });
});
