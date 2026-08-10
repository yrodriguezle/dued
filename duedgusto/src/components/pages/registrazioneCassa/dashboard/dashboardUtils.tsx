// Utility pure condivise dai componenti della dashboard cassa.
// Nessun componente React qui: mantiene i file componente compatibili con il
// fast refresh (react-refresh/only-export-components).

export const MESI_LABEL = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export const MESI_BREVI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const MESI_ANNO = 12;

/**
 * Periodo di default della dashboard: il mese PRECEDENTE a oggi.
 * Il mese corrente è quasi sempre incompleto (registri ancora in corso), quindi
 * i KPI del mese chiuso sono l'unico confronto sensato. A gennaio il riferimento
 * ricade su dicembre dell'anno precedente.
 */
export function periodoMesePrecedente(oggi: Date = new Date()): { anno: number; mese: number } {
  const riferimento = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
  return { anno: riferimento.getFullYear(), mese: riferimento.getMonth() + 1 };
}

/**
 * Variazione % vs periodo precedente: (cur − prev) / |prev| × 100.
 * Restituisce null (indicatore omesso) se il precedente è 0 o assente:
 * niente divisioni per zero, niente "Infinity%".
 */
export function calcolaTrendPercentuale(corrente: number, precedente: number | null | undefined): number | null {
  if (precedente == null || precedente === 0) return null;
  return ((corrente - precedente) / Math.abs(precedente)) * 100;
}

/**
 * Costruisce una serie di esattamente 12 punti (Gen–Dic) dal riepilogo
 * mensile: i mesi assenti valgono 0, nessun buco d'asse con anni parziali.
 */
export function serieDodiciMesi(mesi: RiepilogoMeseDashboard[], seleziona: (mese: RiepilogoMeseDashboard) => number): number[] {
  return Array.from({ length: MESI_ANNO }, (_, indice) => {
    const mese = mesi.find((riepilogo) => riepilogo.mese === indice + 1);
    return mese ? seleziona(mese) : 0;
  });
}
