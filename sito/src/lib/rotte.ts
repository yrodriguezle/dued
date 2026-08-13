// Le pagine del sito, in un posto solo.
//
// Le legge la navigazione dell'intestazione e le legge il piè di pagina. 🔴 Il mockup
// cambia pagina con uno **stato client-side** (`this.setState({ page })`): qui sono **rotte
// vere**, e non è un dettaglio di implementazione. Sono le pagine che la gente cerca —
// «apericosto thiene» è una ricerca — e uno switch client-side le renderebbe un URL solo,
// indicizzabile una volta.
//
// ⚠️ Il mockup ha una sesta voce, «Mobile»: è un mostrino con tre telefoni disegnati, serve
//    a far vedere il layout stretto, e **non è una pagina del sito**.

import type { SitoPubblico } from './tipi.ts';

export interface Rotta {
  percorso: string;
  etichetta: string;
  /** Per `<title>` e per la voce di sitemap: quanto conta rispetto alla home. */
  priorita: number;
  /**
   * Se questa rotta esiste, dato ciò che il CMS contiene.
   *
   * 🔴 Due pagine sono **condizionate al loro testo** e rispondono 404 senza: `/aperitivo` e
   *    `/locale`. Una voce di navigazione che porta a un 404 è peggio di una voce in meno —
   *    e su un'installazione nuova, dove i testi non sono ancora stati scritti, sarebbero
   *    *due su cinque*.
   *
   * ⚠️ Con l'identità non leggibile (`sito === null`) si mostrano **tutte**: in degradazione
   *    non si sa cosa esiste, e nascondere metà del sito perché l'API non risponde
   *    trasformerebbe un guasto temporaneo in una navigazione mutilata.
   */
  esiste: (sito: SitoPubblico | null) => boolean;
}

const SEMPRE = () => true;

export const ROTTE: readonly Rotta[] = [
  { percorso: '/', etichetta: 'Home', priorita: 1.0, esiste: SEMPRE },
  { percorso: '/menu', etichetta: 'Menu', priorita: 0.9, esiste: SEMPRE },
  {
    percorso: '/aperitivo',
    etichetta: 'Aperitivo',
    priorita: 0.8,
    esiste: (sito) => sito === null || sito.testi.aperitivo !== null,
  },
  {
    percorso: '/locale',
    etichetta: 'Il locale',
    priorita: 0.6,
    esiste: (sito) => sito === null || sito.testi.storia !== null,
  },
  { percorso: '/contatti', etichetta: 'Contatti', priorita: 0.7, esiste: SEMPRE },
] as const;

/**
 * Le rotte da mostrare, per questa lettura dell'identità.
 *
 * 🔴 **La stessa funzione la usano navigazione, piè di pagina, 404 e sitemap.** Se ognuno
 *    filtrasse per conto suo, il primo che se ne dimentica pubblica in sitemap un URL che
 *    risponde 404 — e quella è una cosa che non si vede da nessuna parte se non nella Search
 *    Console, settimane dopo.
 */
export function rotteDisponibili(sito: SitoPubblico | null): readonly Rotta[] {
  return ROTTE.filter((rotta) => rotta.esiste(sito));
}

/**
 * Se la rotta è quella corrente.
 *
 * ⚠️ Il confronto normalizza la barra finale. Astro serve `/menu` e `/menu/` come la stessa
 *    pagina, e un confronto secco marcherebbe come "non attiva" la voce nella metà dei casi
 *    — a seconda di come ci si è arrivati, il che è il tipo di differenza che nessuno
 *    riproduce quando gliela si segnala.
 */
export function eCorrente(percorsoRotta: string, percorsoPagina: string): boolean {
  const pulisci = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  return pulisci(percorsoRotta) === pulisci(percorsoPagina);
}
