/**
 * Quali immagini ospita ciascuna pagina del sito — **in un posto solo**.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * PERCHÉ QUESTO FILE ESISTE
 *
 * La domanda dell'utente era letterale: *«ogni pagina del sito una voce di menu, e lì mi dici
 * quante immagini posso caricare e i testi da cambiare»*. La prima metà è questa dichiarazione.
 *
 * 🔴 **Due letture, una sola scrittura.** Le cinque schede di pagina contano da qui, e la
 *    libreria media scrive da qui i ruoli accanto a ogni immagine. Due elenchi che si
 *    corrispondono per disciplina divergono al primo ritocco, e divergerebbero in silenzio: la
 *    scheda direbbe «3 foto» e la libreria ne segnerebbe due. Aggiungere un ruolo qui lo fa
 *    comparire **in entrambi i posti**, ed è precisamente ciò che il test di
 *    `__tests__/ruoliPagine.test.tsx` verifica.
 *
 * 🔴 **Capacità e riempimento sono due grandezze diverse, e questo file dichiara solo la
 *    prima.** `posti` è quanti ne ospita la pagina; quante sono occupate adesso lo dice il
 *    **piano** (`vetrina { ruoliImmagini }`), cioè la stessa funzione C# che alimenta il sito.
 *    Il pannello non ricalcola mai chi ricopre cosa: se lo facesse, potrebbe dichiarare che una
 *    pagina usa una foto mentre il sito ne rende un'altra.
 *
 * ⚠️ L'**anteprima social** non è qui, ed è voluto: è del sito intero, non di una pagina. Ogni
 *    scheda la dichiara come condivisa e nessuna la conta fra i propri posti.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

/** Le cinque pagine del sito. Le stesse di `sito/src/lib/rotte.ts`, che ne resta la sorgente. */
export type PaginaSito = "home" | "menu" | "aperitivo" | "locale" | "contatti";

/** I sei ruoli del piano, con i nomi esatti che il backend rende. */
export type ChiaveRuoloImmagine = "eroeHome" | "grigliaHome" | "fotoMenu" | "ritrattoLocale" | "quadrateLocale" | "eroeAperitivo";

export type RuoloImmaginePagina = {
  chiave: ChiaveRuoloImmagine;
  pagina: PaginaSito;
  /** Nome breve del ruolo, per l'etichetta accanto a un'immagine. 🔴 Mai un numero di posizione. */
  etichetta: string;
  /** Dove sta in pagina, per esteso. */
  descrizione: string;
  /** **Capacità**: quanti posti, non quanti occupati. */
  posti: number;
  /** Un ruolo singolo si sceglie da uno slot; una griglia pesca dalla galleria per posizione. */
  singolo: boolean;
  /**
   * Che cosa rende la pagina quando il posto è vuoto. `null` = **niente**.
   *
   * 🔴 Per `eroeAperitivo` è `null` **per decisione**, non per dimenticanza: vedi la voce.
   */
  ripiego: string | null;
};

/**
 * Il piano, per intero. Le sei righe corrispondono uno a uno ai sei campi di
 * `RuoliImmaginiVetrina` e alle sei regole di `backend/Services/Vetrina/RuoliImmaginiVetrina.cs`.
 *
 * ⚠️ I `posti` delle griglie valgono **3** perché tanto è l'ampiezza della finestra sul server
 *    (`AmpiezzaFinestra`). È l'unico numero scritto due volte, e la divergenza non resta muta:
 *    il test pretende che le immagini occupate non superino mai i posti dichiarati, quindi una
 *    finestra allargata sul server fa diventare rosso il pannello invece di fargli dichiarare
 *    un numero troppo piccolo.
 */
export const RUOLI_IMMAGINI: readonly RuoloImmaginePagina[] = [
  {
    chiave: "eroeHome",
    pagina: "home",
    etichetta: "immagine grande in cima",
    descrizione: "L'immagine grande in cima alla home, sopra la piega.",
    posti: 1,
    singolo: true,
    ripiego: "la prima foto della galleria",
  },
  {
    chiave: "grigliaHome",
    pagina: "home",
    etichetta: "griglia in fondo",
    descrizione: "La griglia di fotografie in fondo alla home.",
    posti: 3,
    singolo: false,
    ripiego: "le foto della galleria, in ordine, saltando quella scelta come immagine grande",
  },
  {
    chiave: "fotoMenu",
    pagina: "menu",
    etichetta: "fotografie del listino",
    descrizione: "Le fotografie in coda al listino.",
    posti: 3,
    singolo: false,
    ripiego: "le prime foto della galleria, in ordine",
  },
  {
    chiave: "ritrattoLocale",
    pagina: "locale",
    etichetta: "ritratto verticale",
    descrizione: "Il ritratto verticale accanto alla storia del locale.",
    posti: 1,
    singolo: true,
    ripiego: "la seconda foto della galleria — la prima, se ce n'è una sola",
  },
  {
    chiave: "quadrateLocale",
    pagina: "locale",
    etichetta: "fotografie quadrate",
    descrizione: "Le tre fotografie quadrate sotto la storia.",
    posti: 3,
    singolo: false,
    ripiego: "le foto della galleria dalla terza in poi, saltando quella scelta come ritratto",
  },
  {
    chiave: "eroeAperitivo",
    pagina: "aperitivo",
    etichetta: "immagine grande in cima",
    descrizione: "L'immagine grande in cima alla pagina dell'aperitivo.",
    posti: 1,
    singolo: true,
    // 🔴 NESSUN ripiego, ed è una decisione presa e scritta, non un caso non gestito.
    //    Prima di questo change la pagina prendeva «l'ultima foto della galleria»: caricare una
    //    foto qualsiasi — anche per un'altra pagina — spostava di nascosto questa immagine. Il
    //    ripiego non è un ponte verso una migrazione ma la semantica PERMANENTE del posto vuoto,
    //    quindi tenerlo avrebbe voluto dire tenere quel difetto per sempre. Senza scelta, la
    //    pagina esce senza immagine di testata: è la stessa regola che governa già tutto il
    //    resto del sito — una sezione senza il suo dato non si rende. La scheda dell'aperitivo
    //    lo dice a chiare lettere, perché è l'unico punto in cui il sito mostra meno di prima.
    ripiego: null,
  },
];

/** Le etichette delle pagine, **identiche** a quelle di `sito/src/lib/rotte.ts`. */
export const ETICHETTE_PAGINE: Record<PaginaSito, string> = {
  home: "Home",
  menu: "Menu",
  aperitivo: "Aperitivo",
  locale: "Il locale",
  contatti: "Contatti",
};

/** L'indirizzo pubblico di ciascuna pagina, come lo digita un visitatore. */
export const PERCORSI_SITO: Record<PaginaSito, string> = {
  home: "/",
  menu: "/menu",
  aperitivo: "/aperitivo",
  locale: "/locale",
  contatti: "/contatti",
};

/** Dove sta la scheda nel gestionale, per i rimandi da una scheda all'altra. */
export const PERCORSI_PANNELLO: Record<PaginaSito, string> = {
  home: "/gestionale/sito/pagine/home",
  menu: "/gestionale/sito/pagine/menu",
  aperitivo: "/gestionale/sito/pagine/aperitivo",
  locale: "/gestionale/sito/pagine/locale",
  contatti: "/gestionale/sito/pagine/contatti",
};

/**
 * La cartella da cui il sito pesca le fotografie di pagina.
 *
 * ⚠️ **Non serve ad attribuire ruoli** — quelli arrivano tutti dal piano del server. Serve
 *    soltanto a **spiegare** a un'immagine senza ruolo perché non ne ha: «è in un'altra
 *    cartella» è una risposta, «nessun ruolo» da solo non lo è.
 */
export const CARTELLA_GALLERIA = "galleria";

/**
 * Le immagini che una pagina mostra e che **non vengono dalla galleria**.
 *
 * 🔴 Vanno dichiarate a parte, altrimenti il conteggio mente in difetto: chi guarda la home
 *    conta quattro fotografie di galleria e ne vede fino a sette. Non entrano nei `posti` della
 *    pagina perché non si scelgono da qui — si scelgono dalla scheda del prodotto.
 */
export type ImmagineFuoriGalleria = {
  pagina: PaginaSito;
  quante: string;
  descrizione: string;
  percorso: string;
  etichettaPercorso: string;
};

export const IMMAGINI_FUORI_GALLERIA: readonly ImmagineFuoriGalleria[] = [
  {
    pagina: "home",
    quante: "fino a 3",
    // ⚠️ «fino a 3» perché la home mostra al massimo tre «momenti» (le prime tre categorie di
    //    vetrina) e ognuno prende la foto del primo piatto della categoria che ne ha una: un
    //    momento senza piatti fotografati non mostra alcuna immagine.
    descrizione: "una per «momento»: la fotografia del primo piatto della categoria che ne ha una",
    percorso: "/gestionale/sito/prodotti",
    etichettaPercorso: "Prodotti vetrina",
  },
];

/** I ruoli di una pagina, letti dalla dichiarazione e non da un elenco parallelo. */
export function ruoliDellaPagina(pagina: PaginaSito): RuoloImmaginePagina[] {
  return RUOLI_IMMAGINI.filter((ruolo) => ruolo.pagina === pagina);
}

/** **Capacità**: quanti posti immagine ospita la pagina. Zero è una risposta, e va scritta. */
export function postiDellaPagina(pagina: PaginaSito): number {
  return ruoliDellaPagina(pagina).reduce((somma, ruolo) => somma + ruolo.posti, 0);
}

/**
 * Le immagini che ricoprono un ruolo **adesso**, secondo il piano del server. Lista vuota
 * quando il posto è libero: è il **riempimento**, e non ha alcun obbligo di arrivare ai posti.
 */
export function immaginiDelRuolo(piano: RuoliImmaginiVetrina | null | undefined, ruolo: RuoloImmaginePagina): MediaAsset[] {
  if (!piano) {
    return [];
  }
  if (ruolo.singolo) {
    const singolo = piano[ruolo.chiave] as RuoloImmagineVetrina | undefined;
    return singolo?.immagine ? [singolo.immagine] : [];
  }
  return (piano[ruolo.chiave] as MediaAsset[] | undefined) ?? [];
}

/**
 * Da dove viene l'immagine di un ruolo singolo: `SLOT` = scelta da un amministratore, `POSIZIONE`
 * = la decide l'ordine della galleria e cambia se la galleria cambia. `null` per le griglie, che
 * per definizione pescano per posizione.
 */
export function origineDelRuolo(piano: RuoliImmaginiVetrina | null | undefined, ruolo: RuoloImmaginePagina): OrigineRuolo | null {
  if (!piano || !ruolo.singolo) {
    return null;
  }
  return (piano[ruolo.chiave] as RuoloImmagineVetrina | undefined)?.origine ?? null;
}

/** **Riempimento**: quante immagini la pagina sta mostrando adesso, sommando i suoi ruoli. */
export function occupatiDellaPagina(piano: RuoliImmaginiVetrina | null | undefined, pagina: PaginaSito): number {
  return ruoliDellaPagina(pagina).reduce((somma, ruolo) => somma + immaginiDelRuolo(piano, ruolo).length, 0);
}

/** Un ruolo che una certa immagine sta ricoprendo, e se ci sta per scelta o per posizione. */
export type RuoloRicoperto = { ruolo: RuoloImmaginePagina; scelto: boolean };

/**
 * Tutti i ruoli che una certa immagine ricopre adesso — **la stessa dichiarazione** da cui le
 * schede contano. Un'immagine può ricoprirne più di uno: con una sola foto in galleria, quella
 * foto è insieme immagine grande della home, ritratto del locale e prima del listino.
 */
export function ruoliDiUnImmagine(piano: RuoliImmaginiVetrina | null | undefined, mediaAssetId: number): RuoloRicoperto[] {
  return RUOLI_IMMAGINI.filter((ruolo) => immaginiDelRuolo(piano, ruolo).some((immagine) => immagine.mediaAssetId === mediaAssetId)).map((ruolo) => ({
    ruolo,
    scelto: origineDelRuolo(piano, ruolo) === "SLOT",
  }));
}

/** L'etichetta di un ruolo ricoperto, **con il nome della pagina** e mai con una posizione. */
export function etichettaRuoloRicoperto(ricoperto: RuoloRicoperto): string {
  return `${ETICHETTE_PAGINE[ricoperto.ruolo.pagina]}: ${ricoperto.ruolo.etichetta}`;
}
