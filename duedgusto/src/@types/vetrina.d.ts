type MediaAsset = {
  __typename?: "MediaAsset";
  mediaAssetId: number;
  /** Percorso relativo alla radice dei media, es. "2026/08/caffe-a1b2c3". Senza host e senza "/media". */
  chiave: string;
  nomeOriginale: string;
  mimeType: string;
  larghezza: number;
  altezza: number;
  /** Larghezze davvero presenti su disco. Da usare per il srcset senza dedurne altre: la pipeline non fa upscaling. */
  larghezzeDisponibili: number[];
  testoAlternativo?: string | null;
  didascalia?: string | null;
  /** Punto focale già pronto per object-position, es. "50% 40%". null = centro. */
  focale?: string | null;
  /** LQIP base64 largo 20 px, già data URI. */
  placeholder?: string | null;
  cartella: string;
  ordinamento: number;
  pubblicato: boolean;
  byteTotali: number;
  createdAt: string;
  updatedAt: string;
};

/** Soli metadati editoriali: i campi tecnici non esistono nell'input, non sono semplicemente ignorati. */
type MediaAssetInput = {
  testoAlternativo?: string | null;
  didascalia?: string | null;
  focale?: string | null;
  cartella: string;
  ordinamento: number;
  pubblicato: boolean;
};

/**
 * Un prodotto letto dal ramo vetrina: i campi contabili ci sono, ma in sola lettura — si
 * scrivono unicamente dalla cassa. I dieci campi vetrina sono gli unici scrivibili da qui,
 * e viaggiano in `ProdottoVetrinaInput`.
 */
type ProdottoVetrina = {
  __typename?: "Prodotto";
  prodottoId: number;
  // ── Cassa: sola lettura ────────────────────────────────────────────────────
  codice: string;
  nome: string;
  prezzo: number;
  categoria?: string | null;
  unitaDiMisura: string;
  attivo: boolean;
  // ── Vetrina ────────────────────────────────────────────────────────────────
  visibileSulSito: boolean;
  nomeVetrina?: string | null;
  descrizioneVetrina?: string | null;
  categoriaVetrina?: string | null;
  /** null = nessun prezzo proprio. Attenzione: 0 è un prezzo valorizzato (omaggio), non un'assenza. */
  prezzoVetrina?: number | null;
  immagineId?: number | null;
  immagine?: MediaAsset | null;
  ordinamentoVetrina: number;
  allergeni?: string | null;
  novita: boolean;
  consigliato: boolean;
  /**
   * Il giorno in cui il prodotto sta sulla **lavagna** all'ingresso, forma `"YYYY-MM-DD"`.
   * Il sito mostra la lavagna solo per i prodotti il cui valore è **oggi**.
   *
   * 🔴 È una data e non un interruttore, ed è l'unica cosa che conta qui: un booleano resta
   *    acceso finché qualcuno si ricorda di spegnerlo, e il primo lunedì di fretta il sito
   *    mostra il piatto di venerdì scorso come «lavagna di oggi». Una data **scade da sola**.
   */
  inLavagnaDal?: string | null;
  // ── Derivati dal server, mai persistiti e mai scrivibili ────────────────────
  /** `attivo && visibileSulSito`. La regola sta sul server: chi la ricalcola qui inventa un secondo criterio. */
  pubblicatoSulSito: boolean;
  /** `prezzoVetrina ?? prezzo`, valutato a ogni lettura. */
  prezzoEffettivoVetrina: number;
  createdAt: string;
  updatedAt: string;
};

type ProdottoVetrinaInput = {
  visibileSulSito: boolean;
  nomeVetrina?: string | null;
  descrizioneVetrina?: string | null;
  categoriaVetrina?: string | null;
  prezzoVetrina?: number | null;
  immagineId?: number | null;
  ordinamentoVetrina: number;
  allergeni?: string | null;
  novita: boolean;
  consigliato: boolean;
  /** `"YYYY-MM-DD"` o `null`. Il sito la mostra solo se è **oggi**: scade da sola. */
  inLavagnaDal?: string | null;
};

/** Corpo della risposta 201 di POST /api/media. */
type MediaCaricato = {
  mediaAssetId: number;
  chiave: string;
  larghezza: number;
  altezza: number;
  larghezzeDisponibili: number[];
  placeholder?: string | null;
  mimeType: string;
};

/** Costanti dei limiti lette da GET /api/media/configurazione: il client non ne ha una copia propria. */
type MediaConfigurazione = {
  maxByteFile: number;
  maxMegapixel: number;
  larghezzeVarianti: number[];
  mimeAmmessi: string[];
  /**
   * Cartelle che l'interfaccia propone nel campo di destinazione. Arrivano dal server per la
   * stessa ragione dei limiti: il frontend non può divergere dal backend perché non ha un
   * proprio valore da far divergere. ⚠️ L'insieme è **aperto** — è un suggerimento, non una
   * tendina chiusa: il campo continua ad accettare un valore digitato.
   */
  cartelleSuggerite: string[];
};

/**
 * Le impostazioni del sito viste da un **amministratore**: è il ramo `vetrina { impostazioni }`,
 * non il contratto pubblico di `/api/public/site`.
 *
 * 🔴 **Nessun campo di orario.** Apertura, chiusura, giorni operativi e fuso vivono in
 * `BusinessSettings` e hanno una sola sorgente: si modificano dalle impostazioni della cassa.
 * Aggiungerli qui — anche solo in lettura — sarebbe il primo passo verso «il sito dice aperto
 * fino alle 21, la cassa alle 19».
 */
type ImpostazioniVetrina = {
  __typename?: "ImpostazioniVetrina";
  /** Vale sempre 1: è un valore di dominio ("la riga"), non un contatore. */
  impostazioniVetrinaId: number;
  // ── Identità pubblica ──────────────────────────────────────────────────────
  /** L'insegna che legge il cliente. Distinta da `businessSettings.businessName`. */
  insegnaPubblica: string;
  // ── Indirizzo, scomposto perché lo pretende schema.org/PostalAddress ────────
  via: string;
  cap: string;
  citta: string;
  provincia: string;
  paese: string;
  /** Valorizzata insieme alla longitudine o nessuna delle due: mezza coordinata è un punto sull'equatore. */
  latitudine?: number | null;
  longitudine?: number | null;
  // ── Contatti e social ──────────────────────────────────────────────────────
  telefono?: string | null;
  email?: string | null;
  /** URL completo del profilo, non l'identificativo: "https://www.instagram.com/2dgusto/", non "@2dgusto". */
  urlInstagram?: string | null;
  urlFacebook?: string | null;
  // ── SEO ────────────────────────────────────────────────────────────────────
  metaTitoloDefault?: string | null;
  metaDescrizioneDefault?: string | null;
  immagineOgId?: number | null;
  immagineOg?: MediaAsset | null;
  // ── Gli slot immagine delle pagine ──────────────────────────────────────────
  //
  // 🔴 Esistono per togliere una regola che viveva **nella posizione**: l'immagine grande della
  //    home era «la prima della galleria», il ritratto del locale «la seconda» e quella
  //    dell'aperitivo «l'ultima», quindi caricare una foto qualsiasi ne cambiava tre.
  //
  // ⚠️ Sono in **sola lettura** finché non arrivano le mutation per pagina: l'input delle
  //    impostazioni non li accetta, ed è deliberato — la scrittura di uno slot deve passare per
  //    la verifica «esiste ed è pubblicata».
  /** L'immagine grande della home. Vuota: il sito usa la prima della galleria. */
  immagineEroeHomeId?: number | null;
  immagineEroeHome?: MediaAsset | null;
  /** Il ritratto di "Il locale". Vuoto: il sito usa la seconda della galleria (la prima se è sola). */
  immagineRitrattoLocaleId?: number | null;
  immagineRitrattoLocale?: MediaAsset | null;
  /**
   * L'immagine grande di "Aperitivo". 🔴 Vuota: la pagina esce **senza** immagine di testata.
   * È l'unico slot **senza ripiego**: quello di prima — l'ultima foto caricata — faceva cambiare
   * questa immagine a ogni caricamento in galleria, anche fatto per un'altra pagina.
   */
  immagineEroeAperitivoId?: number | null;
  immagineEroeAperitivo?: MediaAsset | null;
  // ── Tema ───────────────────────────────────────────────────────────────────
  /** Forma "HH:mm". È un dato, non un calcolo: il confronto con l'ora corrente resta lato client. */
  oraInizioTemaSera: string;
  // ── I testi che il sito scrive in prima persona ─────────────────────────────
  //
  // 🔴 Stanno qui e non dentro un componente del sito perché una frase sul locale scritta nel
  //    codice è una verità che invecchia lontano da chi la conosce: il giorno in cui smette di
  //    essere vera, chi lo sa non ha modo di dirlo. Ogni sezione del sito che li usa **non si
  //    rende affatto** quando sono vuoti — meglio una sezione in meno che una che mente.
  /** Il paragrafo sotto il titolo della home. */
  claimVetrina?: string | null;
  /** La pagina "Il locale": senza il testo, quella rotta risponde 404. */
  storiaTitolo?: string | null;
  storiaTesto?: string | null;
  /** La pagina dell'aperitivo: senza il testo, quella rotta risponde 404. */
  aperitivoTitolo?: string | null;
  aperitivoTesto?: string | null;
  /** Cosa è compreso, **una voce per riga**. Ne vengono pubblicate al massimo sei. */
  aperitivoPunti?: string | null;
  /**
   * Quali categorie di vetrina mostra la pagina dell'aperitivo, **una per riga**, col nome
   * esatto. 🔴 Esiste per non indovinare: cercare la parola «cocktail» nel nome smette di
   * funzionare alla prima rinomina, e la pagina mostrerebbe le cose sbagliate senza lasciare
   * traccia.
   */
  aperitivoCategorie?: string | null;
  // ── Reputazione ────────────────────────────────────────────────────────────
  /** Da 1 a 5. 🔴 Va insieme al conteggio: il sito mostra i due numeri insieme o nessuno. */
  punteggioGoogle?: number | null;
  numeroRecensioniGoogle?: number | null;
  urlProfiloGoogle?: string | null;
  // ── Ganci spenti: si salvano, non fanno ancora nulla sul sito ───────────────
  prenotazioniAttive: boolean;
  prenotazioniPreavvisoOre: number;
  prenotazioniCopertiMax: number;
  /** 🔴 Non esce da /api/public/site. */
  turnstileSiteKey?: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Esattamente i campi scrivibili della scheda **Impostazioni sito**, e nient'altro: identità,
 * indirizzo, coordinate, contatti, social, SEO di default, anteprima social, aspetto e ganci
 * spenti. **Venti.** Nessun identificativo (c'è una riga sola e il resolver sa quale), nessuna
 * marca temporale, nessun campo di orario.
 *
 * 🔴 **I testi editoriali e la reputazione non sono più qui.** Erano dieci campi e sono passati
 * a `PaginaHomeInput`, `PaginaLocaleInput` e `PaginaAperitivoInput`, perché appartengono a **una**
 * pagina e la scheda di quella pagina è l'unico posto da cui si scrivono. Lo schema del server è
 * cambiato di conseguenza: questo tipo e `ImpostazioniVetrinaInputType.cs` si deployano insieme.
 *
 * ⚠️ L'assegnazione del server è **totale su questo gruppo**: si inviano sempre tutti e venti i
 * campi, mai il solo campo toccato — ed è ciò che permette di **svuotare** un campo, cosa che
 * un'assegnazione condizionale renderebbe impossibile. Ciò che il server *non* tocca sono i
 * tredici campi delle altre tre schede, che questo input non nomina.
 */
type ImpostazioniVetrinaInput = {
  insegnaPubblica: string;
  via: string;
  cap: string;
  citta: string;
  provincia: string;
  paese: string;
  latitudine?: number | null;
  longitudine?: number | null;
  telefono?: string | null;
  email?: string | null;
  urlInstagram?: string | null;
  urlFacebook?: string | null;
  metaTitoloDefault?: string | null;
  metaDescrizioneDefault?: string | null;
  immagineOgId?: number | null;
  oraInizioTemaSera: string;
  prenotazioniAttive: boolean;
  prenotazioniPreavvisoOre: number;
  prenotazioniCopertiMax: number;
  /** 🔴 Non si mostra e si trasporta: l'assegnazione è totale **su questo gruppo**, e questo campo appartiene a questo gruppo. */
  turnstileSiteKey?: string | null;
};

/**
 * I campi che la scheda **Home** possiede: il paragrafo sotto il titolo e il grappolo della
 * reputazione. Sono i campi che `/` — e **solo** `/` — rende.
 *
 * 🔴 `punteggioGoogle` e `numeroRecensioniGoogle` stanno **nello stesso input** perché sono un
 *    grappolo a validazione incrociata: il sito mostra i due numeri insieme o nessuno dei due,
 *    e i due membri su due schede diverse renderebbero la regola «insieme o nessuno»
 *    impossibile da valutare al momento del salvataggio.
 *
 * ⚠️ I testi dell'aperitivo sono letti dalla home ma **non le appartengono**: la regola non è
 *    «un campo, una pagina», è **un campo, un proprietario**. La scheda Home li mostra in sola
 *    lettura, con il collegamento a `Sito → Aperitivo`.
 */
type PaginaHomeInput = {
  claimVetrina?: string | null;
  punteggioGoogle?: number | null;
  numeroRecensioniGoogle?: number | null;
  urlProfiloGoogle?: string | null;
  /** Vuoto: la home usa la prima immagine della galleria, e cambia se la galleria cambia. */
  immagineEroeHomeId?: number | null;
};

/**
 * I campi che la scheda **Il locale** possiede.
 *
 * 🔴 `storiaTesto` vuoto significa che `/locale` **non esiste**: risponde 404 e sparisce da
 *    intestazione, piè di pagina, 404 e sitemap. Il titolo da solo non la fa esistere — la
 *    regola del server guarda soltanto il corpo del testo.
 */
type PaginaLocaleInput = {
  storiaTitolo?: string | null;
  storiaTesto?: string | null;
  /** Vuoto: la pagina usa la seconda immagine della galleria — la prima se ce n'è una sola. */
  immagineRitrattoLocaleId?: number | null;
};

/**
 * I campi che la scheda **Aperitivo** possiede.
 *
 * 🔴 `aperitivoTesto` vuoto significa che `/aperitivo` **non esiste**, esattamente come per
 *    `/locale`.
 */
type PaginaAperitivoInput = {
  aperitivoTitolo?: string | null;
  aperitivoTesto?: string | null;
  /** Cosa è compreso, **una voce per riga**. Ne vengono pubblicate al massimo sei. */
  aperitivoPunti?: string | null;
  /** Quali categorie di vetrina mostra la pagina, **una per riga**, col nome esatto. */
  aperitivoCategorie?: string | null;
  /**
   * 🔴 Vuoto: la pagina esce **senza** immagine di testata. È l'unico slot senza ripiego, e la
   * scheda lo dice con parole proprie invece di lasciarlo scoprire al sito.
   */
  immagineEroeAperitivoId?: number | null;
};

/**
 * Da dove viene l'immagine che ricopre un ruolo **singolo**.
 *
 * 🔴 È ciò che permette alla scheda di dire «scelta da te» invece di «è la prima della galleria,
 * e cambierà»: due promesse diverse, e la seconda scade appena qualcuno carica o riordina una
 * foto. `POSIZIONE` vale anche quando lo slot è valorizzato ma punta a un'immagine che la
 * galleria non contiene — non pubblicata, o in un'altra cartella.
 *
 * ⚠️ Non esce da `/api/public/galleria`: il sito rende l'immagine che riceve, e sapere chi
 * l'ha scelta non cambia una riga del suo HTML.
 */
type OrigineRuolo = "SLOT" | "POSIZIONE";

/** Un ruolo singolo di pagina: l'immagine che lo ricopre adesso, e da dove viene. */
type RuoloImmagineVetrina = {
  __typename?: "RuoloImmagineVetrina";
  /** `null` quando nessuna immagine ricopre il ruolo. */
  mediaAssetId?: number | null;
  immagine?: MediaAsset | null;
  origine: OrigineRuolo;
};

/**
 * Quale immagine ricopre quale ruolo su ciascuna pagina del sito, adesso.
 *
 * 🔴 **Lo stesso piano che alimenta il sito**, calcolato dalla stessa funzione del backend: la
 * scheda non può dichiarare che una pagina usa una foto mentre il sito ne rende un'altra. È il
 * motivo per cui la regola posizionale è stata tolta dai quattro `.astro`.
 */
type RuoliImmaginiVetrina = {
  __typename?: "RuoliImmaginiVetrina";
  eroeHome: RuoloImmagineVetrina;
  ritrattoLocale: RuoloImmagineVetrina;
  eroeAperitivo: RuoloImmagineVetrina;
  grigliaHome: MediaAsset[];
  fotoMenu: MediaAsset[];
  quadrateLocale: MediaAsset[];
  /**
   * Quante immagini entrano in **ciascuna** delle tre griglie.
   *
   * 🔴 Arriva dal server perché è lo **stesso** numero che taglia le finestre
   * (`RuoliImmaginiVetrina.AmpiezzaFinestra`). Scriverlo qui accanto sarebbe la seconda
   * scrittura di una costante: allargando la finestra, il sito renderebbe quattro fotografie
   * mentre la scheda continuerebbe a dichiararne tre, con sicurezza e senza alcun errore.
   *
   * ⚠️ È **capacità**, non riempimento: una galleria corta ne rende meno.
   */
  ampiezzaGriglia: number;
};

/**
 * Dove un valore del sito **compare**: una delle cinque pagine, oppure la **cornice**.
 *
 * 🔴 `CORNICE` non è una pagina: è ciò che intestazione, piè di pagina e dati strutturati
 * rendono su **tutte**. Distinguerla è ciò che permette alla scheda «Menu» di dire insieme
 * «questa pagina non possiede alcun testo» e «l'indirizzo che vedi nel piè di pagina si cambia
 * qui», senza far sembrare l'indirizzo un campo di quella pagina.
 */
type PaginaVetrinaMappa = "CORNICE" | "HOME" | "MENU" | "APERITIVO" | "LOCALE" | "CONTATTI";

/**
 * Dove un valore si **modifica**.
 *
 * ⚠️ Due delle sei sedi non sono schede del sito: gli orari vivono nelle impostazioni della
 * cassa (una sola sorgente, ed è ciò che rende impossibile «il sito dice 21, la cassa 19») e le
 * citazioni nell'anagrafica delle recensioni.
 */
type SchedaVetrinaMappa = "IMPOSTAZIONI" | "HOME" | "LOCALE" | "APERITIVO" | "IMPOSTAZIONI_CASSA" | "RECENSIONI_SITO";

/**
 * Una riga della mappa pagina → campo, servita dal backend.
 *
 * 🔴 **Sede unica della corrispondenza.** Le cinque schede costruiscono da qui le due sezioni
 * dei testi: un elenco scritto a mano dentro ogni scheda divergerebbe dai sorgenti del sito
 * alla prima modifica, e nessuno se ne accorgerebbe — una scheda che elenca il campo sbagliato
 * non produce alcun errore. `sito/test/mappa-pagine.test.mjs` confronta la stessa
 * dichiarazione con i `.astro`.
 */
type VocePaginaVetrina = {
  __typename?: "VocePaginaVetrina";
  pagina: PaginaVetrinaMappa;
  /** Il nome della proprietà del modello, es. `InsegnaPubblica`. */
  campo: string;
  /** Il percorso nel DTO pubblico, es. `testi.storia.testo`: è ciò che il sito legge. */
  percorso: string;
  scheda: SchedaVetrinaMappa;
  etichetta: string;
  nota?: string | null;
};

/**
 * Una recensione **riportata** sul sito.
 *
 * 🔴 Non è una recensione ricevuta: il sito non raccoglie giudizi, non c'è alcun form e nessuna
 * rotta pubblica scrive su questa tabella. Sono citazioni scelte dall'amministratore da ciò che
 * i clienti hanno già scritto altrove.
 *
 * ⚠️ Riportare una recensione altrui è una **citazione**: va riportata fedelmente e attribuita.
 * Riscriverne il testo «perché suoni meglio» e lasciarci la firma di un cliente non è
 * marketing, è un'affermazione falsa attribuita a una persona reale.
 */
type RecensioneVetrina = {
  __typename?: "RecensioneVetrina";
  recensioneVetrinaId: number;
  /** Come va firmata in pagina. È una firma, non un identificativo. */
  autore: string;
  testo: string;
  /** Da dove viene la citazione, es. "Google". */
  fonte?: string | null;
  /** Da 1 a 5. Il vincolo è anche a database. */
  punteggio: number;
  ordinamento: number;
  /** 🔴 Default `false`: una recensione appena inserita non va online per il solo fatto di essere stata salvata. */
  pubblicata: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Esattamente i campi scrivibili: l'identificativo è un argomento a sé della mutation. */
type RecensioneVetrinaInput = {
  autore: string;
  testo: string;
  fonte?: string | null;
  punteggio: number;
  ordinamento: number;
  pubblicata: boolean;
};
