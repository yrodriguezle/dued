/**
 * Chi possiede quale campo delle impostazioni della vetrina — **in un posto solo**.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTO FILE ESISTE
 *
 * Il pannello «Sito» si divide in schede modellate sulle pagine, e ogni scheda salva **solo il
 * proprio gruppo di campi**. Perché quella divisione sia sicura servono due proprietà insieme:
 *
 *   - **totale**    — nessun campo resta orfano. Un campo che nessuna scheda possiede è un
 *                     campo che nessuno può più modificare, e la sua perdita è invisibile: il
 *                     valore resta corretto finché non serve cambiarlo;
 *   - **disgiunta** — nessun campo ha due proprietari. Due schede che scrivono lo stesso campo
 *                     sono due verità, e vince l'ultima che salva.
 *
 * Questo file garantisce la **prima** delle due, e la garantisce dal **compilatore**: vedi la
 * nota su `Record` qui sotto. La seconda la garantisce il test di partizione, perché il sistema
 * dei tipi non la vede — se un campo finisse in due schede, l'intersezione lo nominerebbe
 * comunque una volta sola e questa mappa resterebbe valida.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

/** Le sei schede del pannello, meno le due che non possiedono alcun campo (`/menu`, `/contatti`). */
export type SchedaSito = "impostazioni" | "home" | "locale" | "aperitivo";

/**
 * I campi scrivibili, tutti, in un tipo solo.
 *
 * ⚠️ È un'**intersezione** e non un'unione: `keyof (A & B)` è `keyof A | keyof B`, cioè
 *    l'insieme di tutte le chiavi. I quattro input sono disgiunti, quindi ogni chiave compare
 *    esattamente una volta.
 *
 * ⚠️ Finché `ImpostazioniVetrinaInput` non è ridotto ai suoi 20 campi (Fase 5), i tre input di
 *    pagina sono **sottoinsiemi** di quello: l'intersezione nomina comunque le stesse chiavi, e
 *    va bene così. È deliberato — la rete di prova deve esistere **prima** che il modulo si
 *    divida, altrimenti verificherebbe il codice appena scritto invece del contrario.
 */
export type CampiScrivibiliVetrina = ImpostazioniVetrinaInput & PaginaHomeInput & PaginaLocaleInput & PaginaAperitivoInput;

export type CampoScrivibileVetrina = keyof CampiScrivibiliVetrina;

/**
 * La partizione, per intero.
 *
 * 🔴 `Record<CampoScrivibileVetrina, …>` e **non** `Partial<Record<…>>`: aggiungere un campo
 *    scrivibile senza assegnarlo a una scheda è un **errore di compilazione**, non un test
 *    rosso — e `npm run ts:check` gira in CI. È il posto in cui «quale scheda possiede questo
 *    campo» smette di essere conoscenza e diventa una firma.
 *
 * 🔴 I due **grappoli a validazione incrociata** cadono ciascuno dentro una scheda sola, e non
 *    per fortuna: è il vincolo che ha determinato questa tabella.
 *      - `latitudine` + `longitudine`             → `impostazioni` (stanno con l'indirizzo)
 *      - `punteggioGoogle` + `numeroRecensioniGoogle` → `home` (il blocco reputazione si rende
 *        solo lì)
 *    I due membri di una coppia su schede diverse renderebbero la regola «insieme o nessuno dei
 *    due» impossibile da valutare al momento del salvataggio.
 *
 * ⚠️ `aperitivoTitolo`/`Testo`/`Punti` sono **letti anche dalla home** e restano di proprietà
 *    dell'Aperitivo. È il caso che rende falsa la regola «un campo, una pagina» e vera quella
 *    «un campo, un proprietario»: la scheda Home li mostra in sola lettura, con il collegamento
 *    a dove si cambiano.
 */
export const PROPRIETA_CAMPI: Record<CampoScrivibileVetrina, SchedaSito> = {
  // ── Identità pubblica ──────────────────────────────────────────────────────────────────
  insegnaPubblica: "impostazioni",
  // ── Indirizzo ──────────────────────────────────────────────────────────────────────────
  via: "impostazioni",
  cap: "impostazioni",
  citta: "impostazioni",
  provincia: "impostazioni",
  paese: "impostazioni",
  // 🔴 Grappolo 1: le due coordinate, insieme.
  latitudine: "impostazioni",
  longitudine: "impostazioni",
  // ── Contatti e social ──────────────────────────────────────────────────────────────────
  telefono: "impostazioni",
  email: "impostazioni",
  urlInstagram: "impostazioni",
  urlFacebook: "impostazioni",
  // ── SEO di default e anteprima social, condivise da tutte le pagine ─────────────────────
  metaTitoloDefault: "impostazioni",
  metaDescrizioneDefault: "impostazioni",
  immagineOgId: "impostazioni",
  // ── Aspetto ────────────────────────────────────────────────────────────────────────────
  oraInizioTemaSera: "impostazioni",
  // ── Ganci spenti: si salvano, non fanno ancora nulla sul sito ───────────────────────────
  prenotazioniAttive: "impostazioni",
  prenotazioniPreavvisoOre: "impostazioni",
  prenotazioniCopertiMax: "impostazioni",
  turnstileSiteKey: "impostazioni",

  // ── Home ───────────────────────────────────────────────────────────────────────────────
  claimVetrina: "home",
  // 🔴 Grappolo 2: punteggio e conteggio, insieme, con il profilo che li accompagna.
  punteggioGoogle: "home",
  numeroRecensioniGoogle: "home",
  urlProfiloGoogle: "home",
  // 🔴 Lo slot immagine appartiene alla scheda della SUA pagina, e non a «Impostazioni sito»
  //    insieme all'anteprima social: l'anteprima è del sito intero, questa è di una pagina sola.
  //    È il punto in cui la divisione della scrittura e gli slot per ruolo si incastrano invece
  //    di sommarsi.
  immagineEroeHomeId: "home",

  // ── Il locale ──────────────────────────────────────────────────────────────────────────
  storiaTitolo: "locale",
  storiaTesto: "locale",
  immagineRitrattoLocaleId: "locale",

  // ── Aperitivo ──────────────────────────────────────────────────────────────────────────
  aperitivoTitolo: "aperitivo",
  aperitivoTesto: "aperitivo",
  aperitivoPunti: "aperitivo",
  aperitivoCategorie: "aperitivo",
  immagineEroeAperitivoId: "aperitivo",
};

/**
 * L'elenco dei campi scrivibili, **derivato** dalla mappa.
 *
 * 🔴 Mai una seconda lista scritta a mano: due elenchi della stessa cosa divergono, e il modo
 *    in cui divergono qui sarebbe silenzioso — un campo presente nell'uno e assente nell'altro
 *    farebbe passare per corretta esattamente la partizione che il test deve rifiutare.
 */
export const CAMPI_SCRIVIBILI = Object.keys(PROPRIETA_CAMPI) as CampoScrivibileVetrina[];

/** I campi di una scheda, letti dalla mappa e non da un elenco parallelo. */
export function campiDellaScheda(scheda: SchedaSito): CampoScrivibileVetrina[] {
  return CAMPI_SCRIVIBILI.filter((campo) => PROPRIETA_CAMPI[campo] === scheda);
}
