// Modulo formule condivise per gli aggregati di cassa (dashboard + adapter fallback).
// UNICO posto client dove vivono le formule gestionali: devono restare identiche,
// al centesimo, a quelle di VistaMensile.tsx (monthlyStats, righe 84-107) e
// RiepilogoIncassiMensile.tsx (totaleSpese/differenza).
// Nessuna dipendenza da React: funzioni pure, testabili in isolamento.
import { statoRegistroCassa } from "../globals/constants";

const MESI_ANNO = 12;

/** Indici dei mesi 1-12, riferimento stabile a livello di modulo. */
export const INDICI_MESI: readonly number[] = Object.freeze(Array.from({ length: MESI_ANNO }, (_, indice) => indice + 1));

/** Crea un riepilogo mensile a zero per il mese indicato. */
export function creaMeseVuoto(anno: number, mese: number): RiepilogoMeseDashboard {
  return {
    anno,
    mese,
    totaleVendite: 0,
    ricavoTracciato: 0,
    ricavoNonTracciato: 0,
    speseTracciate: 0,
    speseNonTracciate: 0,
    incassoContanteTracciato: 0,
    incassiElettronici: 0,
    incassiFattura: 0,
    registri: 0,
    chiusi: 0,
    bozze: 0,
    totaleSpese: 0,
    differenza: 0,
  };
}

/**
 * Normalizza un riepilogo mensile ricevuto dal server aggiungendo i derivati client
 * (totaleSpese, differenza) e azzerando eventuali campi null/undefined.
 */
export function normalizzaMeseServer(mese: RiepilogoMeseCassaServer): RiepilogoMeseDashboard {
  const totaleVendite = mese.totaleVendite ?? 0;
  const speseTracciate = mese.speseTracciate ?? 0;
  const speseNonTracciate = mese.speseNonTracciate ?? 0;
  const totaleSpese = speseTracciate + speseNonTracciate;
  return {
    anno: mese.anno,
    mese: mese.mese,
    totaleVendite,
    ricavoTracciato: mese.ricavoTracciato ?? 0,
    ricavoNonTracciato: mese.ricavoNonTracciato ?? 0,
    speseTracciate,
    speseNonTracciate,
    incassoContanteTracciato: mese.incassoContanteTracciato ?? 0,
    incassiElettronici: mese.incassiElettronici ?? 0,
    incassiFattura: mese.incassiFattura ?? 0,
    registri: mese.registri ?? 0,
    chiusi: mese.chiusi ?? 0,
    bozze: mese.bozze ?? 0,
    totaleSpese,
    differenza: totaleVendite - totaleSpese,
  };
}

/**
 * Garantisce esattamente 12 mesi ordinati 1-12: i mesi mancanti vengono
 * riempiti con riepiloghi a zero.
 */
export function completaDodiciMesi(anno: number, mesi: RiepilogoMeseDashboard[]): RiepilogoMeseDashboard[] {
  return INDICI_MESI.map((mese) => mesi.find((riepilogo) => riepilogo.mese === mese) ?? creaMeseVuoto(anno, mese));
}

/** Estrae anno e mese da una data ISO ("2026-03-01" o "2026-03-01T00:00:00.000Z"). */
function annoMeseDaData(data: string | null | undefined): { anno: number; mese: number } | null {
  if (!data) return null;
  const [annoStr, meseStr] = data.split("T")[0].split("-");
  const anno = parseInt(annoStr, 10);
  const mese = parseInt(meseStr, 10);
  if (Number.isNaN(anno) || Number.isNaN(mese) || mese < 1 || mese > MESI_ANNO) return null;
  return { anno, mese };
}

/**
 * Aggrega i registri cassa dell'anno per mese con le STESSE formule della vista
 * mensile (VistaMensile.tsx):
 * - movimento fisico = totaleChiusura − totaleApertura (null → 0)
 * - vendite = totaleVendite server, fallback movimento + elettronici + fatture
 * - ricavo tracciato = contante tracciato + elettronici + fatture
 * - ricavo non tracciato = movimento fisico − contante tracciato (può essere negativo)
 * - spese tracciate = speseFornitori; non tracciate = speseGiornaliere
 * Bozze (DRAFT) incluse nei totali, come nella vista mensile.
 * Output: sempre 12 mesi ordinati 1-12 (mesi senza registri a zero).
 */
export function aggregaRegistriPerMese(registri: RegistroCassa[], anno: number): RiepilogoMeseDashboard[] {
  const perMese = registri.reduce((acc, cr) => {
    const chiave = annoMeseDaData(cr.data);
    // Filtro di sicurezza: ignora registri fuori dall'anno richiesto
    if (!chiave || chiave.anno !== anno) return acc;

    const corrente = acc.get(chiave.mese) ?? creaMeseVuoto(anno, chiave.mese);
    // Formule identiche a VistaMensile.tsx (monthlyStats)
    const movimentoCassa = (cr.totaleChiusura ?? 0) - (cr.totaleApertura ?? 0);
    const contanteTracciato = cr.incassoContanteTracciato ?? 0;
    const elettronici = cr.incassiElettronici ?? 0;
    const fatture = cr.incassiFattura ?? 0;
    // Totale Vendite — valore server quando disponibile (backend unica fonte di
    // verità); fallback con la stessa formula backend/KPI giornaliero.
    const venditeRegistro = cr.totaleVendite ?? movimentoCassa + elettronici + fatture;

    acc.set(chiave.mese, {
      ...corrente,
      totaleVendite: corrente.totaleVendite + venditeRegistro,
      ricavoTracciato: corrente.ricavoTracciato + contanteTracciato + elettronici + fatture,
      ricavoNonTracciato: corrente.ricavoNonTracciato + (movimentoCassa - contanteTracciato),
      speseTracciate: corrente.speseTracciate + (cr.speseFornitori || 0),
      speseNonTracciate: corrente.speseNonTracciate + (cr.speseGiornaliere || 0),
      incassoContanteTracciato: corrente.incassoContanteTracciato + contanteTracciato,
      incassiElettronici: corrente.incassiElettronici + elettronici,
      incassiFattura: corrente.incassiFattura + fatture,
      registri: corrente.registri + 1,
      chiusi: corrente.chiusi + (cr.stato === statoRegistroCassa.CLOSED || cr.stato === statoRegistroCassa.RECONCILED ? 1 : 0),
      bozze: corrente.bozze + (cr.stato === statoRegistroCassa.DRAFT ? 1 : 0),
    });
    return acc;
  }, new Map<number, RiepilogoMeseDashboard>());

  const mesiAggregati = Array.from(perMese.values()).map((mese) => {
    const totaleSpese = mese.speseTracciate + mese.speseNonTracciate;
    return {
      ...mese,
      totaleSpese,
      differenza: mese.totaleVendite - totaleSpese,
    };
  });

  return completaDodiciMesi(anno, mesiAggregati);
}

/**
 * Somma i riepiloghi mensili in un totale di periodo (anno). I derivati
 * totaleSpese/differenza sono ricalcolati sulle somme (stesse formule di
 * RiepilogoIncassiMensile.tsx).
 */
export function derivaTotali(mesi: RiepilogoMeseDashboard[]): Omit<RiepilogoMeseDashboard, "mese"> {
  const somma = mesi.reduce(
    (acc, mese) => ({
      anno: mese.anno,
      totaleVendite: acc.totaleVendite + mese.totaleVendite,
      ricavoTracciato: acc.ricavoTracciato + mese.ricavoTracciato,
      ricavoNonTracciato: acc.ricavoNonTracciato + mese.ricavoNonTracciato,
      speseTracciate: acc.speseTracciate + mese.speseTracciate,
      speseNonTracciate: acc.speseNonTracciate + mese.speseNonTracciate,
      incassoContanteTracciato: acc.incassoContanteTracciato + mese.incassoContanteTracciato,
      incassiElettronici: acc.incassiElettronici + mese.incassiElettronici,
      incassiFattura: acc.incassiFattura + mese.incassiFattura,
      registri: acc.registri + mese.registri,
      chiusi: acc.chiusi + mese.chiusi,
      bozze: acc.bozze + mese.bozze,
    }),
    {
      anno: 0,
      totaleVendite: 0,
      ricavoTracciato: 0,
      ricavoNonTracciato: 0,
      speseTracciate: 0,
      speseNonTracciate: 0,
      incassoContanteTracciato: 0,
      incassiElettronici: 0,
      incassiFattura: 0,
      registri: 0,
      chiusi: 0,
      bozze: 0,
    }
  );

  const totaleSpese = somma.speseTracciate + somma.speseNonTracciate;
  return {
    ...somma,
    totaleSpese,
    differenza: somma.totaleVendite - totaleSpese,
  };
}
