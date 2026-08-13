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
  oraInizioTemaSera: "",
  claimVetrina: "",
  storiaTitolo: "",
  storiaTesto: "",
  aperitivoTitolo: "",
  aperitivoTesto: "",
  aperitivoPunti: "",
  aperitivoCategorie: "",
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
    oraInizioTemaSera: testo(impostazioni.oraInizioTemaSera),
    claimVetrina: testo(impostazioni.claimVetrina),
    storiaTitolo: testo(impostazioni.storiaTitolo),
    storiaTesto: testo(impostazioni.storiaTesto),
    aperitivoTitolo: testo(impostazioni.aperitivoTitolo),
    aperitivoTesto: testo(impostazioni.aperitivoTesto),
    aperitivoPunti: testo(impostazioni.aperitivoPunti),
    aperitivoCategorie: testo(impostazioni.aperitivoCategorie),
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

export function inputDaValori(valori: ValoriImpostazioniVetrina): ImpostazioniVetrinaInput {
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
    claimVetrina: nullSeVuoto(valori.claimVetrina),
    storiaTitolo: nullSeVuoto(valori.storiaTitolo),
    storiaTesto: nullSeVuoto(valori.storiaTesto),
    aperitivoTitolo: nullSeVuoto(valori.aperitivoTitolo),
    aperitivoTesto: nullSeVuoto(valori.aperitivoTesto),
    // ⚠️ Le due aree «una voce per riga» NON si normalizzano qui: si manda ciò che è stato
    //    scritto, e le righe vuote le toglie il DTO pubblico. Ripulirle in due posti
    //    significherebbe due regole di pulizia che un giorno divergono — e quella che conta è
    //    l'altra, perché è quella che il sito legge.
    aperitivoPunti: nullSeVuoto(valori.aperitivoPunti),
    aperitivoCategorie: nullSeVuoto(valori.aperitivoCategorie),
    punteggioGoogle: numeroONull(valori.punteggioGoogle),
    numeroRecensioniGoogle: numeroONull(valori.numeroRecensioniGoogle),
    urlProfiloGoogle: nullSeVuoto(valori.urlProfiloGoogle),
    prenotazioniAttive: Boolean(valori.prenotazioniAttive),
    prenotazioniPreavvisoOre: Number(valori.prenotazioniPreavvisoOre) || 0,
    prenotazioniCopertiMax: Number(valori.prenotazioniCopertiMax) || 0,
    turnstileSiteKey: nullSeVuoto(valori.turnstileSiteKey),
  };
}

/** Un campo facoltativo vuoto non è un errore: si valida solo ciò che è stato scritto. */
function urlFacoltativo(messaggio: string) {
  return z.string().refine((valore) => valore.trim() === "" || z.string().url().safeParse(valore.trim()).success, { message: messaggio });
}

const schemaValidazione = z
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
    claimVetrina: z.string(),
    storiaTitolo: z.string(),
    storiaTesto: z.string(),
    aperitivoTitolo: z.string(),
    aperitivoTesto: z.string(),
    aperitivoPunti: z.string(),
    aperitivoCategorie: z.string(),
    punteggioGoogle: z.string(),
    numeroRecensioniGoogle: z.string(),
    urlProfiloGoogle: urlFacoltativo("Serve l'URL completo del profilo Google del locale"),
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

    // 🔴 Stesso controllo incrociato delle coordinate, per la stessa ragione: presi da soli
    //    questi due numeri non sono un dato incompleto, sono un dato FUORVIANTE. «4,7» senza
    //    conteggio nasconde che le recensioni potrebbero essere tre; «180 recensioni» senza
    //    media nasconde che la media potrebbe essere 2,1. Il sito li mostra insieme o non li
    //    mostra, quindi è qui che l'appaiamento va imposto.
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

export function validaImpostazioniVetrina(valori: ValoriImpostazioniVetrina): Record<string, string> | undefined {
  const esito = schemaValidazione.safeParse(valori);
  if (esito.success) {
    return;
  }
  const errori: Record<string, string> = {};
  esito.error.issues.forEach((problema) => {
    errori[problema.path[0] as string] = problema.message;
  });
  return errori;
}
