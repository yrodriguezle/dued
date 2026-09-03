// Le pagine del sito, in un posto solo.
//
// Le legge la navigazione dell'intestazione e le legge il piè di pagina. 🔴 Il mockup
// cambia pagina con uno **stato client-side** (`this.setState({ page })`): qui sono **rotte
// vere**, e non è un dettaglio di implementazione. Sono le pagine che la gente cerca —
// «apericosto thiene» è una ricerca — e uno switch client-side le renderebbe un URL solo,
// indicizzabile una volta.
//
// ⚠️ Il mockup ha una voce in più, «Mobile»: è un mostrino con tre telefoni disegnati, serve
//    a far vedere il layout stretto, e **non è una pagina del sito**.

import { GIORNI_ESTESI } from './formato.ts';
import type { SitoPubblico } from './tipi.ts';

/**
 * Una rotta **come la legge un consumatore**: l'etichetta è già la parola da scrivere in pagina.
 *
 * 🔴 Esiste perché una voce ha un nome che dipende dal contenuto — «Piatto del **mercoledì**», e
 *    il giorno lo sceglie l'amministratore — e **nessuno dei quattro consumatori deve saperlo**:
 *    intestazione, piè di pagina, 404 e sitemap scrivono `rotta.etichetta` e basta. È
 *    `rotteDisponibili` a risolverlo, una volta, per tutti.
 */
export interface VoceRotta {
  percorso: string;
  etichetta: string;
  /** Per `<title>` e per la voce di sitemap: quanto conta rispetto alla home. */
  priorita: number;
}

export interface Rotta {
  percorso: string;

  /**
   * Il nome **canonico** della pagina: come si chiama, non come si intitola oggi.
   *
   * 🔴 <b>È anche il titolo della sua scheda nel gestionale</b>, e
   *    `test/schede-pannello.test.mjs` lo confronta con `SeedMenusSito.cs` **carattere per
   *    carattere**. Deve quindi essere un **letterale**, adiacente a `percorso`: è la forma che
   *    quella scansione riconosce, e una voce scritta altrimenti sparirebbe dal confronto in
   *    silenzio invece di renderlo rosso.
   */
  etichetta: string;

  /**
   * Il nome che il **visitatore** legge, quando dipende da ciò che il CMS contiene.
   *
   * 🔴 Due nomi e non uno, ed è la stessa distinzione che il backend fa fra `InsegnaPubblica` e
   *    il nome del gestionale: sono due pubblici. Chi amministra cerca «la pagina del piatto
   *    della settimana» — un nome che non cambia, altrimenti la voce di menu del pannello si
   *    sposterebbe sotto i piedi a ogni cambio di giorno. Chi visita legge «Piatto del
   *    mercoledì», che è l'informazione.
   *
   * ⚠️ Assente su tutte le altre rotte, dove il nome non dipende da nulla: un campo obbligatorio
   *    avrebbe voluto dire cinque funzioni che restituiscono una costante.
   *
   * ⚠️ Riceve `null` in degradazione, come `esiste`, e deve rispondere lo stesso: lì la
   *    navigazione si mostra intera, quindi un nome deve esserci comunque.
   */
  etichettaPubblica?: (sito: SitoPubblico | null) => string;

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

/**
 * Il nome della voce del piatto: «Piatto del mercoledì», con il giorno che l'amministratore ha
 * scelto.
 *
 * 🔴 **Il giorno cambia il nome, non l'indirizzo.** La rotta è e resta `/piatto-del-giorno`: uno
 *    slug che seguisse il giorno — `/piatto-del-mercoledi` che diventa `/piatto-del-giovedi` —
 *    romperebbe ogni link condiviso e ogni voce già indicizzata **ogni volta che qualcuno cambia
 *    giorno dal gestionale**, cioè trasformerebbe un'impostazione innocua in una migrazione di
 *    URL. Nessun sintomo visibile dal pannello, e il danno si legge nella Search Console
 *    settimane dopo.
 *
 * ⚠️ Il ripiego è «Piatto del giorno», e copre due casi che non vale la pena distinguere: il
 *    backend non risponde, oppure il piatto non è pubblicato. Nel secondo la voce non compare
 *    affatto; nel primo si mostra tutto (vedi `esiste`), e un nome generico è meglio di un nome
 *    inventato.
 */
const ETICHETTA_PIATTO = (sito: SitoPubblico | null): string => {
  const giorno = sito?.testi.piatto?.giorno;
  // ⚠️ `?? 'giorno'` e non `GIORNI_ESTESI[giorno]` diretto: l'indice arriva dall'API, e un
  //    valore fuori scala scriverebbe «Piatto del undefined» in un `<a>`, in un `<h1>` e nel
  //    `<title>`. A database c'è un CHECK che lo impedisce — questa riga è ciò che rende il sito
  //    indipendente da quella promessa.
  const nome = giorno === undefined ? undefined : GIORNI_ESTESI[giorno]?.toLowerCase();
  return `Piatto del ${nome ?? 'giorno'}`;
};

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
    percorso: '/piatto-del-giorno',
    etichetta: 'Piatto della settimana',
    etichettaPubblica: ETICHETTA_PIATTO,
    priorita: 0.8,
    esiste: (sito) => sito === null || sito.testi.piatto !== null,
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
export function rotteDisponibili(sito: SitoPubblico | null): readonly VoceRotta[] {
  return ROTTE.filter((rotta) => rotta.esiste(sito)).map((rotta) => ({
    percorso: rotta.percorso,
    // 🔴 L'etichetta si risolve QUI, una volta, e i consumatori ricevono una stringa. È ciò che
    //    ha reso questo change invisibile a intestazione, piè di pagina, 404 e sitemap: nessuno
    //    dei quattro ha dovuto imparare che un nome può dipendere dal contenuto, e nessuno dei
    //    quattro può dimenticarsene.
    etichetta: rotta.etichettaPubblica?.(sito) ?? rotta.etichetta,
    priorita: rotta.priorita,
  }));
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
