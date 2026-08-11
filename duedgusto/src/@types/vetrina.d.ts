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
  // ── Tema ───────────────────────────────────────────────────────────────────
  /** Forma "HH:mm". È un dato, non un calcolo: il confronto con l'ora corrente resta lato client. */
  oraInizioTemaSera: string;
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
 * Esattamente i campi **scrivibili**, e nient'altro: nessun identificativo (c'è una riga sola e
 * il resolver sa quale), nessuna marca temporale, nessun campo di orario.
 *
 * ⚠️ L'assegnazione del server è **totale**: si invia sempre l'intero input, mai il solo campo
 * toccato — ed è ciò che permette di **svuotare** un campo, cosa che un'assegnazione
 * condizionale renderebbe impossibile.
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
  turnstileSiteKey?: string | null;
};
