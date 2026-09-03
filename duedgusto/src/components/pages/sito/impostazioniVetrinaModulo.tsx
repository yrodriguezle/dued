import { z } from "zod";

/**
 * Il modulo delle impostazioni della vetrina, senza React: mappatura, validazione e forma
 * dell'input. Vive in un file proprio come `parseSettingsFromRaw` per le impostazioni della
 * cassa — così la pagina esporta soltanto il componente, e queste funzioni si provano
 * direttamente, senza rendere nulla.
 */

/**
 * Lunghezze oltre le quali i motori di ricerca troncano il testo nei risultati. Non sono limiti:
 * sono il punto in cui il titolo smette di leggersi per intero, e il contatore lo mostra mentre
 * si scrive invece di scoprirlo pubblicando.
 */
export const META_TITOLO_CONSIGLIATO = 60;
export const META_DESCRIZIONE_CONSIGLIATA = 155;

/**
 * Stesso formato del backend (`^([01][0-9]|2[0-3]):[0-5][0-9]$`), non il `\d{2}:\d{2}` con cui il
 * frontend valida gli orari della cassa: qui "25:00" e "18:60" sono rifiutati da entrambe le
 * parti. ⚠️ La validazione del client **non sostituisce** quella del server — le stesse regole
 * valgono per una chiamata GraphQL diretta.
 */
export const FORMATO_ORARIO = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * I valori del modulo. Le coordinate viaggiano come **stringhe** e non come numeri: `""` è
 * l'unica rappresentazione onesta di "coordinata non inserita", e uno `0` non lo è — zero è un
 * punto reale al largo del golfo di Guinea.
 */
export type ValoriImpostazioniVetrina = {
  insegnaPubblica: string;
  via: string;
  cap: string;
  citta: string;
  provincia: string;
  paese: string;
  latitudine: string;
  longitudine: string;
  telefono: string;
  email: string;
  urlInstagram: string;
  urlFacebook: string;
  metaTitoloDefault: string;
  metaDescrizioneDefault: string;
  immagineOgId: number | null;
  /**
   * I quattro slot immagine delle pagine.
   *
   * ⚠️ Stanno nei valori del modulo pur non essendo ancora modificabili da nessun campo: è la
   * stessa ragione per cui ci sta `turnstileSiteKey`. L'assegnazione del server è **totale**,
   * quindi un campo che il modulo non trasporta viene azzerato dal salvataggio della scheda che
   * lo possiede — e uno slot azzerato non dà errore, riporta semplicemente la pagina al ripiego
   * posizionale, cioè al difetto che gli slot esistono per togliere.
   */
  immagineEroeHomeId: number | null;
  immagineRitrattoLocaleId: number | null;
  immagineEroeAperitivoId: number | null;
  immagineEroePiattoId: number | null;
  oraInizioTemaSera: string;
  // ── I testi che il sito scrive in prima persona ─────────────────────────────────────
  // Ogni sezione del sito che li usa NON si rende quando sono vuoti, e le due pagine
  // editoriali rispondono 404: sono campi che decidono se una rotta esiste.
  claimVetrina: string;
  storiaTitolo: string;
  storiaTesto: string;
  aperitivoTitolo: string;
  aperitivoTesto: string;
  aperitivoPunti: string;
  aperitivoCategorie: string;
  piattoTitolo: string;
  piattoTesto: string;
  /**
   * Il giorno del piatto: **0 = lunedì … 6 = domenica**.
   *
   * ⚠️ È un `number` e non una stringa, a differenza delle coordinate e del punteggio: quelli
   *    hanno uno stato «non inserito» che solo `""` rappresenta onestamente, questo no — la
   *    tendina ha sempre una voce scelta, e il campo non è nullable nemmeno a database.
   */
  piattoGiorno: number;
  // ── Reputazione ────────────────────────────────────────────────────────────────────
  /**
   * Testuali per la stessa ragione delle coordinate: `""` è l'unica rappresentazione onesta
   * di «non inserito», e uno `0` non lo è — zero recensioni è un'affermazione, non un vuoto.
   */
  punteggioGoogle: string;
  numeroRecensioniGoogle: string;
  urlProfiloGoogle: string;
  prenotazioniAttive: boolean;
  prenotazioniPreavvisoOre: number;
  prenotazioniCopertiMax: number;
  /**
   * ⚠️ Non si mostra e non si modifica dalla pagina, ma **si trasporta**: l'assegnazione del
   * server è totale, quindi un campo che il modulo non rispedisce viene azzerato dal
   * salvataggio. Chi lo avesse valorizzato altrove se lo vedrebbe sparire senza alcun errore.
   */
  turnstileSiteKey: string;
};

export const VALORI_VUOTI: ValoriImpostazioniVetrina = {
  insegnaPubblica: "",
  via: "",
  cap: "",
  citta: "",
  provincia: "",
  paese: "",
  latitudine: "",
  longitudine: "",
  telefono: "",
  email: "",
  urlInstagram: "",
  urlFacebook: "",
  metaTitoloDefault: "",
  metaDescrizioneDefault: "",
  immagineOgId: null,
  immagineEroeHomeId: null,
  immagineRitrattoLocaleId: null,
  immagineEroeAperitivoId: null,
  immagineEroePiattoId: null,
  oraInizioTemaSera: "",
  claimVetrina: "",
  storiaTitolo: "",
  storiaTesto: "",
  aperitivoTitolo: "",
  aperitivoTesto: "",
  aperitivoPunti: "",
  aperitivoCategorie: "",
  piattoTitolo: "",
  piattoTesto: "",
  // ⚠️ 2 = mercoledì, lo stesso default del modello: un modulo vuoto e una riga appena creata
  //    devono mostrare la stessa cosa, altrimenti aprire la scheda e salvarla senza toccare
  //    niente sposterebbe il giorno.
  piattoGiorno: 2,
  punteggioGoogle: "",
  numeroRecensioniGoogle: "",
  urlProfiloGoogle: "",
  prenotazioniAttive: false,
  prenotazioniPreavvisoOre: 0,
  prenotazioniCopertiMax: 0,
  turnstileSiteKey: "",
};

/** `null`/`undefined` e stringa sono la stessa cosa nel modulo: il campo vuoto. */
function testo(valore?: string | null): string {
  return valore ?? "";
}

function numeroTestuale(valore?: number | null): string {
  return valore === null || valore === undefined ? "" : String(valore);
}

export function valoriDaImpostazioni(impostazioni?: ImpostazioniVetrina | null): ValoriImpostazioniVetrina {
  if (!impostazioni) {
    return VALORI_VUOTI;
  }
  return {
    insegnaPubblica: testo(impostazioni.insegnaPubblica),
    via: testo(impostazioni.via),
    cap: testo(impostazioni.cap),
    citta: testo(impostazioni.citta),
    provincia: testo(impostazioni.provincia),
    paese: testo(impostazioni.paese),
    latitudine: numeroTestuale(impostazioni.latitudine),
    longitudine: numeroTestuale(impostazioni.longitudine),
    telefono: testo(impostazioni.telefono),
    email: testo(impostazioni.email),
    urlInstagram: testo(impostazioni.urlInstagram),
    urlFacebook: testo(impostazioni.urlFacebook),
    metaTitoloDefault: testo(impostazioni.metaTitoloDefault),
    metaDescrizioneDefault: testo(impostazioni.metaDescrizioneDefault),
    immagineOgId: impostazioni.immagineOgId ?? null,
    immagineEroeHomeId: impostazioni.immagineEroeHomeId ?? null,
    immagineRitrattoLocaleId: impostazioni.immagineRitrattoLocaleId ?? null,
    immagineEroeAperitivoId: impostazioni.immagineEroeAperitivoId ?? null,
    immagineEroePiattoId: impostazioni.immagineEroePiattoId ?? null,
    oraInizioTemaSera: testo(impostazioni.oraInizioTemaSera),
    claimVetrina: testo(impostazioni.claimVetrina),
    storiaTitolo: testo(impostazioni.storiaTitolo),
    storiaTesto: testo(impostazioni.storiaTesto),
    aperitivoTitolo: testo(impostazioni.aperitivoTitolo),
    aperitivoTesto: testo(impostazioni.aperitivoTesto),
    aperitivoPunti: testo(impostazioni.aperitivoPunti),
    aperitivoCategorie: testo(impostazioni.aperitivoCategorie),
    piattoTitolo: testo(impostazioni.piattoTitolo),
    piattoTesto: testo(impostazioni.piattoTesto),
    piattoGiorno: impostazioni.piattoGiorno ?? VALORI_VUOTI.piattoGiorno,
    punteggioGoogle: numeroTestuale(impostazioni.punteggioGoogle),
    numeroRecensioniGoogle: numeroTestuale(impostazioni.numeroRecensioniGoogle),
    urlProfiloGoogle: testo(impostazioni.urlProfiloGoogle),
    prenotazioniAttive: Boolean(impostazioni.prenotazioniAttive),
    prenotazioniPreavvisoOre: impostazioni.prenotazioniPreavvisoOre ?? 0,
    prenotazioniCopertiMax: impostazioni.prenotazioniCopertiMax ?? 0,
    turnstileSiteKey: testo(impostazioni.turnstileSiteKey),
  };
}

/**
 * Il campo vuoto diventa `null`, non `""`: **svuotare è un'operazione voluta** e il server la
 * esegue perché assegna sempre tutti i campi. È il ciclo che un `if (valore)` sul server — o un
 * campo omesso qui — renderebbe silenziosamente impossibile.
 */
function nullSeVuoto(valore: string): string | null {
  const pulito = valore.trim();
  return pulito === "" ? null : pulito;
}

function numeroONull(valore: string): number | null {
  const pulito = valore.trim();
  return pulito === "" ? null : Number(pulito);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LE QUATTRO COSTRUZIONI, UNA PER SCHEDA — ora indipendenti
//
// 🔴 Fino alla fase precedente queste quattro erano **proiezioni** di un `inputDaValori` unico,
//    filtrate per `PROPRIETA_CAMPI`. Adesso sono quattro **costruttori indipendenti**, scritti
//    a mano uno per uno, e `inputDaValori` è sparito con l'ultimo dei suoi chiamanti.
//
// 🔴 **È il momento per cui il test di partizione è stato scritto prima.** Finché erano
//    proiezioni, «l'unione delle quattro copre esattamente i campi scrivibili» era vero per
//    costruzione e il test non poteva che essere verde. Adesso è una cosa che qualcuno deve
//    aver scritto giusto a mano, quattro volte, e il test è l'unica ragione per cui dimenticare
//    `urlProfiloGoogle` qui sotto non produce un salvataggio che lo azzera in silenzio.
//    Se per restare verde quel test avesse richiesto un ritocco, la divisione sarebbe sbagliata.
//
// ⚠️ Ogni campo compare in **una sola** di queste quattro funzioni. Non è una raccomandazione:
//    è ciò che il test di disgiunzione verifica, ed è la ragione per cui non esiste alcun
//    helper condiviso che «riempia i campi comuni» — non ci sono campi comuni.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * I campi della scheda **Impostazioni sito**: identità, indirizzo, coordinate, contatti,
 * social, SEO di default, anteprima social, aspetto e ganci spenti. Venti.
 *
 * ⚠️ `turnstileSiteKey` viaggia pur non essendo mostrato da alcun campo. La ragione non è più
 *    «l'assegnazione del server è totale» in astratto — sarebbe un argomento che vale per tutte
 *    le schede e quindi per nessuna: è che l'assegnazione è totale **su questo gruppo**, e
 *    questo campo **appartiene a questo gruppo**. Non rispedirlo lo cancellerebbe a ogni
 *    salvataggio della scheda del sito; nessun'altra scheda può toccarlo.
 */
export function inputImpostazioni(valori: ValoriImpostazioniVetrina): ImpostazioniVetrinaInput {
  return {
    insegnaPubblica: valori.insegnaPubblica.trim(),
    via: valori.via.trim(),
    cap: valori.cap.trim(),
    citta: valori.citta.trim(),
    provincia: valori.provincia.trim(),
    paese: valori.paese.trim(),
    latitudine: numeroONull(valori.latitudine),
    longitudine: numeroONull(valori.longitudine),
    telefono: nullSeVuoto(valori.telefono),
    email: nullSeVuoto(valori.email),
    urlInstagram: nullSeVuoto(valori.urlInstagram),
    urlFacebook: nullSeVuoto(valori.urlFacebook),
    metaTitoloDefault: nullSeVuoto(valori.metaTitoloDefault),
    metaDescrizioneDefault: nullSeVuoto(valori.metaDescrizioneDefault),
    immagineOgId: valori.immagineOgId,
    oraInizioTemaSera: valori.oraInizioTemaSera.trim(),
    prenotazioniAttive: Boolean(valori.prenotazioniAttive),
    prenotazioniPreavvisoOre: Number(valori.prenotazioniPreavvisoOre) || 0,
    prenotazioniCopertiMax: Number(valori.prenotazioniCopertiMax) || 0,
    turnstileSiteKey: nullSeVuoto(valori.turnstileSiteKey),
  };
}

/**
 * I campi della scheda **Home**: il paragrafo sotto il titolo, il grappolo della reputazione e
 * lo slot dell'immagine grande.
 *
 * ⚠️ I testi dell'aperitivo **non sono qui**, benché la home li renda: la scheda Home li mostra
 *    in sola lettura e non li spedisce. Spedirli vorrebbe dire due schede che scrivono lo stesso
 *    campo, cioè due verità con la vittoria dell'ultima che salva.
 */
export function inputHome(valori: ValoriImpostazioniVetrina): PaginaHomeInput {
  return {
    claimVetrina: nullSeVuoto(valori.claimVetrina),
    punteggioGoogle: numeroONull(valori.punteggioGoogle),
    numeroRecensioniGoogle: numeroONull(valori.numeroRecensioniGoogle),
    urlProfiloGoogle: nullSeVuoto(valori.urlProfiloGoogle),
    immagineEroeHomeId: valori.immagineEroeHomeId,
  };
}

/**
 * I campi della scheda **Il locale**: titolo e testo della storia, e lo slot del ritratto.
 *
 * 🔴 `storiaTesto` svuotato **fa sparire la pagina dal sito**: 404, navigazione e sitemap. È il
 *    motivo per cui `nullSeVuoto` è qui e non un `if (valore)` da qualche parte — svuotare deve
 *    poter arrivare fino al database.
 */
export function inputLocale(valori: ValoriImpostazioniVetrina): PaginaLocaleInput {
  return {
    storiaTitolo: nullSeVuoto(valori.storiaTitolo),
    storiaTesto: nullSeVuoto(valori.storiaTesto),
    immagineRitrattoLocaleId: valori.immagineRitrattoLocaleId,
  };
}

/** I campi della scheda **Aperitivo**: titolo, testo, punti, categorie e lo slot dell'eroe. */
export function inputAperitivo(valori: ValoriImpostazioniVetrina): PaginaAperitivoInput {
  return {
    aperitivoTitolo: nullSeVuoto(valori.aperitivoTitolo),
    aperitivoTesto: nullSeVuoto(valori.aperitivoTesto),
    // ⚠️ Le due aree «una voce per riga» NON si normalizzano qui: si manda ciò che è stato
    //    scritto, e le righe vuote le toglie il DTO pubblico. Ripulirle in due posti
    //    significherebbe due regole di pulizia che un giorno divergono — e quella che conta è
    //    l'altra, perché è quella che il sito legge.
    aperitivoPunti: nullSeVuoto(valori.aperitivoPunti),
    aperitivoCategorie: nullSeVuoto(valori.aperitivoCategorie),
    immagineEroeAperitivoId: valori.immagineEroeAperitivoId,
  };
}

/**
 * I campi della scheda **Piatto della settimana**: nome, descrizione, giorno e lo slot della
 * fotografia.
 *
 * 🔴 `piattoTesto` svuotato **fa sparire la pagina dal sito**: 404, navigazione e sitemap. Come
 *    per la storia del locale, `nullSeVuoto` è ciò che permette a uno svuotamento di arrivare
 *    fino al database invece di essere scartato per strada.
 *
 * ⚠️ `piattoGiorno` si spedisce **sempre**, anche quando la pagina non esiste: non è nullable e
 *    l'assegnazione del server è totale, quindi ometterlo non lo lascerebbe com'è — lo
 *    porterebbe a zero, cioè a lunedì.
 */
export function inputPiatto(valori: ValoriImpostazioniVetrina): PaginaPiattoInput {
  return {
    piattoTitolo: nullSeVuoto(valori.piattoTitolo),
    piattoTesto: nullSeVuoto(valori.piattoTesto),
    piattoGiorno: valori.piattoGiorno,
    immagineEroePiattoId: valori.immagineEroePiattoId,
  };
}

/** Un campo facoltativo vuoto non è un errore: si valida solo ciò che è stato scritto. */
function urlFacoltativo(messaggio: string) {
  return z.string().refine((valore) => valore.trim() === "" || z.string().url().safeParse(valore.trim()).success, { message: messaggio });
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LA VALIDAZIONE, UNO SCHEMA PER SCHEDA
//
// 🔴 Fino alla fase precedente esisteva **uno** schema con **un** `superRefine` che conteneva
//    ENTRAMBI i grappoli incrociati: coordinate e reputazione. Adesso ce n'è uno per scheda, e
//    i due grappoli si sono divisi — le coordinate stanno con l'indirizzo in «Impostazioni
//    sito», la reputazione sta nella «Home», che è l'unica pagina che la rende.
//
// 🔴 **La proprietà che la divisione non deve perdere è che ciascun controllo incrociato
//    segnali ENTRAMBI i campi della propria coppia.** Un controllo spezzato fra due schemi
//    segnalerebbe solo quello che lo schema conosce, e l'amministratore vedrebbe un errore su
//    un campo dicendogli di guardarne un altro che quella scheda non mostra. È la ragione per
//    cui i due grappoli non potevano essere separati fra due schede, e la ragione per cui i due
//    test che lo dimostrano sono stati replicati, uno per schema.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const schemaImpostazioniSito = z
  .object({
    insegnaPubblica: z.string().trim().min(1, "L'insegna pubblica è il nome che legge il cliente: non può restare vuota"),
    via: z.string(),
    cap: z.string(),
    citta: z.string(),
    provincia: z.string(),
    paese: z.string(),
    latitudine: z.string(),
    longitudine: z.string(),
    telefono: z.string(),
    email: z.string().refine((valore) => valore.trim() === "" || z.string().email().safeParse(valore.trim()).success, { message: "Indirizzo email non valido" }),
    urlInstagram: urlFacoltativo('Serve l\'URL completo del profilo — per esempio "https://www.instagram.com/2dgusto/" — e non il nome utente'),
    urlFacebook: urlFacoltativo('Serve l\'URL completo della pagina — per esempio "https://www.facebook.com/2dgusto/" — e non il nome utente'),
    metaTitoloDefault: z.string(),
    metaDescrizioneDefault: z.string(),
    oraInizioTemaSera: z.string().regex(FORMATO_ORARIO, 'Formato orario non valido: serve "HH:mm" fra "00:00" e "23:59"'),
    prenotazioniPreavvisoOre: z.number().min(0, "Il preavviso non può essere negativo"),
    prenotazioniCopertiMax: z.number().min(0, "I coperti non possono essere negativi"),
  })
  // 🔴 Controllo INCROCIATO: mezza coordinata è un punto sull'equatore, cioè un luogo sbagliato
  // mostrato con sicurezza. Non è una regola sul singolo campo, quindi non può stare su uno dei
  // due — e infatti segnala entrambi.
  .superRefine((valori, contesto) => {
    const latitudine = valori.latitudine.trim();
    const longitudine = valori.longitudine.trim();
    const messaggioIncrociato = "Latitudine e longitudine vanno inserite insieme, oppure lasciate entrambe vuote";

    if ((latitudine === "") !== (longitudine === "")) {
      contesto.addIssue({ code: z.ZodIssueCode.custom, path: ["latitudine"], message: messaggioIncrociato });
      contesto.addIssue({ code: z.ZodIssueCode.custom, path: ["longitudine"], message: messaggioIncrociato });
      return;
    }

    if (latitudine !== "" && !(Number(latitudine) >= -90 && Number(latitudine) <= 90)) {
      contesto.addIssue({ code: z.ZodIssueCode.custom, path: ["latitudine"], message: "La latitudine deve stare fra -90 e 90" });
    }
    if (longitudine !== "" && !(Number(longitudine) >= -180 && Number(longitudine) <= 180)) {
      contesto.addIssue({ code: z.ZodIssueCode.custom, path: ["longitudine"], message: "La longitudine deve stare fra -180 e 180" });
    }
  });

const schemaPaginaHome = z
  .object({
    claimVetrina: z.string(),
    punteggioGoogle: z.string(),
    numeroRecensioniGoogle: z.string(),
    urlProfiloGoogle: urlFacoltativo("Serve l'URL completo del profilo Google del locale"),
  })
  // 🔴 Stesso controllo incrociato delle coordinate, per la stessa ragione: presi da soli
  //    questi due numeri non sono un dato incompleto, sono un dato FUORVIANTE. «4,7» senza
  //    conteggio nasconde che le recensioni potrebbero essere tre; «180 recensioni» senza
  //    media nasconde che la media potrebbe essere 2,1. Il sito li mostra insieme o non li
  //    mostra, quindi è qui che l'appaiamento va imposto.
  //
  // ⚠️ Ed è **qui** e non nello schema delle impostazioni perché i due campi appartengono a
  //    questa scheda: un controllo incrociato vive dove vivono entrambi i suoi membri, sempre.
  .superRefine((valori, contesto) => {
    const punteggio = valori.punteggioGoogle.trim();
    const numero = valori.numeroRecensioniGoogle.trim();
    const messaggioReputazione = "Il punteggio e il numero di recensioni vanno inseriti insieme, oppure lasciati entrambi vuoti";

    if ((punteggio === "") !== (numero === "")) {
      contesto.addIssue({ code: z.ZodIssueCode.custom, path: ["punteggioGoogle"], message: messaggioReputazione });
      contesto.addIssue({ code: z.ZodIssueCode.custom, path: ["numeroRecensioniGoogle"], message: messaggioReputazione });
      return;
    }

    if (punteggio !== "" && !(Number(punteggio) >= 1 && Number(punteggio) <= 5)) {
      contesto.addIssue({ code: z.ZodIssueCode.custom, path: ["punteggioGoogle"], message: "Il punteggio deve stare fra 1 e 5" });
    }
    if (numero !== "" && !(Number.isInteger(Number(numero)) && Number(numero) >= 0)) {
      contesto.addIssue({ code: z.ZodIssueCode.custom, path: ["numeroRecensioniGoogle"], message: "Il numero di recensioni deve essere un intero non negativo" });
    }
  });

/**
 * Le due schede editoriali non hanno alcuna regola incrociata e nessun campo obbligatorio:
 * **anche svuotare è un'operazione legittima**, ed è quella che ritira la pagina dal sito.
 * Gli schemi esistono comunque, perché una scheda senza `validate` sarebbe l'unica del gruppo a
 * non averne uno — e la prima regola che servisse domani nascerebbe in un posto nuovo.
 */
const schemaPaginaLocale = z.object({
  storiaTitolo: z.string(),
  storiaTesto: z.string(),
});

const schemaPaginaAperitivo = z.object({
  aperitivoTitolo: z.string(),
  aperitivoTesto: z.string(),
  aperitivoPunti: z.string(),
  aperitivoCategorie: z.string(),
});

/**
 * ⚠️ A differenza delle altre due schede editoriali, questa **una regola ce l'ha**: il giorno è
 *    un indice, e un indice fuori scala non è un campo malcompilato — è un titolo che dice
 *    «Piatto del undefined» su una pagina pubblica. Il `CHECK` a database e il resolver lo
 *    rifiutano entrambi; qui lo si dice all'amministratore prima del viaggio, con una frase.
 */
const schemaPaginaPiatto = z.object({
  piattoTitolo: z.string(),
  piattoTesto: z.string(),
  piattoGiorno: z.number().int().min(0, "Scegli un giorno della settimana.").max(6, "Scegli un giorno della settimana."),
});

/**
 * Il traduttore da esito Zod alla forma che Formik si aspetta, **uno solo** per tutte e quattro
 * le schede: quattro copie di sei righe divergerebbero al primo campo annidato.
 */
function erroriDi(schema: z.ZodTypeAny, valori: ValoriImpostazioniVetrina): Record<string, string> | undefined {
  const esito = schema.safeParse(valori);
  if (esito.success) {
    return;
  }
  const errori: Record<string, string> = {};
  esito.error.issues.forEach((problema) => {
    errori[problema.path[0] as string] = problema.message;
  });
  return errori;
}

/** La validazione della scheda **Impostazioni sito**. Contiene il grappolo delle coordinate. */
export function validaImpostazioniSito(valori: ValoriImpostazioniVetrina): Record<string, string> | undefined {
  return erroriDi(schemaImpostazioniSito, valori);
}

/** La validazione della scheda **Home**. Contiene il grappolo della reputazione. */
export function validaPaginaHome(valori: ValoriImpostazioniVetrina): Record<string, string> | undefined {
  return erroriDi(schemaPaginaHome, valori);
}

export function validaPaginaLocale(valori: ValoriImpostazioniVetrina): Record<string, string> | undefined {
  return erroriDi(schemaPaginaLocale, valori);
}

export function validaPaginaAperitivo(valori: ValoriImpostazioniVetrina): Record<string, string> | undefined {
  return erroriDi(schemaPaginaAperitivo, valori);
}

export function validaPaginaPiatto(valori: ValoriImpostazioniVetrina): Record<string, string> | undefined {
  return erroriDi(schemaPaginaPiatto, valori);
}
