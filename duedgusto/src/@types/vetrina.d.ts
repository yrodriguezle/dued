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
};
