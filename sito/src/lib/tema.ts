// Le due funzioni che l'orologio decide — e che il SERVER non deve decidere mai.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// 🔴 PERCHÉ QUESTE DUE COSE SONO CLIENT-SIDE, E PERCHÉ È LA STESSA DECISIONE PRESA DUE VOLTE
//
// `/api/public/site` è cacheabile 300 s, e davanti alle pagine ci sarà un micro-cache
// nginx. Un tema calcolato server-side ha solo due esiti, entrambi guasti:
//
//   • la chiave di cache si frammenta (due copie di ogni pagina, e il micro-cache serve a
//     metà), oppure
//   • metà dei visitatori riceve **il tema di chi ha riempito la cache**.
//
// Lo stesso vale per "aperto ora", che la proposal descriveva come *derivato dall'API* —
// il che suggerisce il frontmatter. Ma "aperto ora" è una funzione dell'OROLOGIO:
// renderizzarlo server-side produce un HTML che **cambia da solo nel tempo**, che resta
// stantio fino a 60 s (potendo dire "aperto" dopo la chiusura) e che fa fallire la prova di
// identità byte per byte appena due richieste cadono a cavallo di un minuto.
//
// La divisione è netta e vale per entrambe:
//   • gli ORARI sono DATO      → server-side, sono nell'HTML
//   • lo STATO è OROLOGIO      → client-side, non è nell'HTML
//
// 🔴 Chi "migliora" questo codice spostando il confronto sul server rompe il micro-cache
//    SENZA CHE NULLA DIVENTI ROSSO, tranne la quarta asserzione di `identita.test.mjs`.
//
// ⚠️ Queste funzioni finiscono nel browser SERIALIZZATE con `Function.prototype.toString()`
//    (vedi `Base.astro`), perché la formula deve esistere in UN SOLO POSTO del progetto:
//    qui, dove i test la esercitano. Conseguenza vincolante: **devono essere
//    autosufficienti**. Nessun import, nessuna costante esterna, nessun riferimento a
//    qualcosa che nel browser non esisterebbe — il corpo della funzione è tutto ciò che
//    arriva. Un test pinna che la serializzazione produca ancora codice funzionante.
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * `"HH:mm"` a Roma, qualunque fuso abbia il visitatore.
 *
 * ⚠️ `hourCycle: 'h23'` e **non** `hour12: false`: quest'ultimo restituisce `"24:00"` a
 *    mezzanotte in alcune versioni di ICU, e `"24:00" >= "18:00"` darebbe il registro
 *    serale all'ora sbagliata per sessanta minuti l'anno — un guasto che si manifesta una
 *    notte su trecentosessantacinque e che nessuno riprodurrebbe mai.
 */
export function oraDiRoma(adesso: Date = new Date()): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(adesso);
}

/**
 * Il giorno della settimana a Roma, con **lunedì = 0**, come `giorniOperativi` dell'API.
 *
 * ⚠️ `Date.getDay()` non va bene per due ragioni: usa il fuso del visitatore (a Tokyo è già
 *    domani) e mette **domenica a 0**, mentre l'array del backend parte da lunedì. Due
 *    disallineamenti che si compensano solo per caso.
 */
export function giornoDiRoma(adesso: Date = new Date()): number {
  const nome = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
  }).format(adesso);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(nome);
}

/**
 * 🔴 **Il confine del registro serale ha DUE estremi, e vengono entrambi dall'API.**
 *
 * ```
 * sera  ⟺  ora >= oraInizioTemaSera  ∨  ora < orari.apertura
 * ```
 *
 * La sola prima metà dà il **tema giorno alle due di notte** (`"01:00" >= "18:00"` è
 * falso). L'estremo di uscita **non è una costante inventata**: è l'orario di apertura, che
 * l'API già espone. Il registro notturno finisce **quando il locale apre** — nessun numero
 * nuovo, e nessun secondo posto in cui un orario possa divergere dal database.
 *
 * Il confronto è fra stringhe `"HH:mm"` a zero fisso: l'ordine lessicografico e quello
 * cronologico coincidono, e non serve convertire in minuti.
 */
export function eSera(ora: string, oraSera: string, oraApertura: string): boolean {
  return ora >= oraSera || ora < oraApertura;
}

/**
 * Se il locale è aperto adesso.
 *
 * ⚠️ `giorniOperativi` può essere `null` — il backend lo espone così quando il JSON
 *    persistito non è leggibile come sette booleani, perché *omettere gli orari settimanali
 *    è meglio che dichiararne di sbagliati*. In quel caso ci si limita al **confronto
 *    orario**, invece di indovinare i giorni.
 */
export function eAperto(
  ora: string,
  giorno: number,
  apertura: string,
  chiusura: string,
  giorniOperativi: boolean[] | null
): boolean {
  if (giorniOperativi && giorniOperativi[giorno] === false) return false;
  return ora >= apertura && ora < chiusura;
}
