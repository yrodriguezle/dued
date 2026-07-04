// Fixture condivise per i test dei componenti UI della dashboard cassa.
// Riusano le formule normative di aggregaRegistri per costruire mock
// RiepilogoDashboard coerenti (derivati totaleSpese/differenza inclusi).
import { completaDodiciMesi, creaMeseVuoto, derivaTotali } from "../../../../../../common/registroCassa/aggregaRegistri";

export const ANNO_TEST = 2026;

/** Crea un riepilogo mensile con derivati ricalcolati dalle formule normative. */
export function creaMese(anno: number, mese: number, overrides: Partial<RiepilogoMeseDashboard> = {}): RiepilogoMeseDashboard {
  const base = { ...creaMeseVuoto(anno, mese), ...overrides };
  const totaleSpese = base.speseTracciate + base.speseNonTracciate;
  return {
    ...base,
    totaleSpese,
    differenza: base.totaleVendite - totaleSpese,
  };
}

/** Costruisce un RiepilogoDashboard completo (12 mesi garantiti + totali annuali). */
export function creaRiepilogo(anno: number, mesiParziali: RiepilogoMeseDashboard[], fonte: RiepilogoDashboard["fonte"] = "server"): RiepilogoDashboard {
  const mesi = completaDodiciMesi(anno, mesiParziali);
  return {
    anno,
    mesi,
    totaliAnno: { ...derivaTotali(mesi), anno },
    meseCorrente: null,
    fonte,
  };
}

/** Marzo con i valori delle fixture di parità (registriCassaFixtures). */
export const meseMarzo = creaMese(ANNO_TEST, 3, {
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
});

/** Riepilogo vuoto: anno senza alcun registro. */
export const riepilogoVuoto = creaRiepilogo(ANNO_TEST, []);
