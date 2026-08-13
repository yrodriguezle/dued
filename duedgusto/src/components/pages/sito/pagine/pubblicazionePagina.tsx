/**
 * Se una pagina del sito **esiste**, e cosa fa un salvataggio al suo indirizzo.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTO FILE ESISTE
 *
 * Due pagine su cinque — `/aperitivo` e `/locale` — esistono **solo se** il loro testo è
 * scritto. Vuoto, la pagina risponde 404 e sparisce da intestazione, piè di pagina e sitemap.
 *
 * 🔴 **Il criterio è del server e qui si rispecchia, non si reinventa.** `PublicController.TestiDa`
 *    decide che una sezione è assente guardando **solo il corpo del testo**: un titolo compilato
 *    con il testo vuoto è ancora «non pubblicata». Se il pannello scrivesse una seconda regola —
 *    per esempio «titolo *oppure* testo» — mostrerebbe «Pubblicata» su una pagina che risponde
 *    404, cioè direbbe il falso con sicurezza, che è il modo peggiore di sbagliare per uno
 *    strumento di orientamento.
 *
 * ⚠️ Le tre funzioni sono **pure e senza React** apposta: sono la parte che si prova senza
 *    rendere niente, come `impostazioniVetrinaModulo`.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * Lo stato che la scheda dichiara **come prima riga**.
 *
 * `sempre` non è «pubblicata»: è una pagina che non ha alcuno stato condizionato, e dirle
 * «Pubblicata» suggerirebbe che possa smettere di esserlo.
 */
export type StatoPubblicazione =
  | { tipo: "sempre" }
  | {
      tipo: "condizionata";
      pubblicata: boolean;
      /** Come si chiama, in pagina, il campo che la fa esistere. Mai il nome della colonna. */
      nomeCampo: string;
    };

/**
 * La pagina esiste? 🔴 Decide **solo il corpo del testo**, esattamente come il server: uno
 * spazio non è un testo, e un titolo non è il testo.
 */
export function ePubblicata(corpoDelTesto?: string | null): boolean {
  return typeof corpoDelTesto === "string" && corpoDelTesto.trim() !== "";
}

/**
 * Salvare **farebbe sparire** una pagina che adesso c'è.
 *
 * 🔴 È l'unico punto del prodotto in cui svuotare un campo **cancella un URL**, ed è la sola
 *    condizione che merita una conferma: estenderla a «ogni campo che si svuota» annegherebbe
 *    proprio il caso da far notare, e restringerla al titolo insegnerebbe una regola falsa.
 *
 * @param dalServer il valore **letto dal server**, non quello iniziale del modulo: la domanda è
 *   se la pagina è online adesso, non se l'utente l'ha già toccata.
 */
export function faSparireLaPagina(dalServer?: string | null, dalModulo?: string | null): boolean {
  return ePubblicata(dalServer) && !ePubblicata(dalModulo);
}

/**
 * Salvare **farebbe nascere** una pagina che adesso non esiste. Non richiede conferma — non c'è
 * nulla da perdere — ma va **dichiarato nell'esito**: che un URL sia appena diventato
 * raggiungibile è un'informazione che l'amministratore non ha modo di ricavare altrove.
 */
export function faNascereLaPagina(dalServer?: string | null, dalModulo?: string | null): boolean {
  return !ePubblicata(dalServer) && ePubblicata(dalModulo);
}
