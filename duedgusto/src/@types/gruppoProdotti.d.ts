/**
 * Un **raggruppamento libero** di prodotti: un tasto solo al banco dove oggi ce ne sono dieci.
 *
 * 🔴 Libero significa deciso dall'utente, non derivato: non è la categoria contabile e non è una
 *    fascia di prezzo. Un gruppo è un livello *sopra* i prodotti e serve proprio a tagliare di
 *    traverso — le varianti di uno spritz stanno in categorie e prezzi diversi e restano lo
 *    stesso gesto.
 */
type GruppoProdotti = {
  __typename?: "GruppoProdotti";
  gruppoProdottiId: number;
  /** Chiave stabile, **univoca**: non cambia quando cambia il nome mostrato. */
  codice: string;
  /** L'etichetta sul tastone: «Spritz», «Caffè», «Cocktail». */
  nome: string;
  /** Colore del **tastone del gruppo**. ⚠️ Non è il colore delle varianti, che sta sul prodotto. */
  colore?: string | null;
  /** Posizione del tastone nella griglia. `0` è «mai ordinato», non «primo». */
  ordinamento: number;
  /** Un gruppo spento sparisce dalla griglia e i suoi membri tornano a comparire sciolti. */
  attivo: boolean;
  membri: MembroGruppo[];
  /**
   * Il minimo fra i membri **attivi**, per il «da X €» sul tastone.
   *
   * 🔴 Calcolato in lettura e **mai persistito**: un prezzo indicativo salvato invecchia in
   *    silenzio e diverge dal listino appena qualcuno ritocca una variante.
   *
   * `null` quando il gruppo non ha membri attivi.
   */
  prezzoMinimo?: number | null;
  /** Vero se tutte le varianti attive costano uguale: il tastone mostra il prezzo senza «da». */
  prezzoUniforme: boolean;
};

/**
 * Un membro del gruppo: il prodotto più il posto che occupa **dentro** quel gruppo.
 *
 * ⚠️ `ordinamento` sta qui e non sul prodotto perché è **per gruppo**: lo stesso spritz può
 *    essere il primo sotto «Spritz» e il terzo sotto «Aperitivi».
 */
type MembroGruppo = {
  __typename?: "MembroGruppo";
  prodottoId: number;
  ordinamento: number;
  prodotto: ProdottoVendibile | null;
};

/**
 * L'input di `mutateGruppoProdotti`: upsert per `gruppoProdottiId` (assente o `0` = creazione).
 *
 * 🔴 **`membri` è una sostituzione totale**, e i tre valori hanno tre significati: `undefined`
 *    o `null` è «non toccare l'elenco», la lista vuota è «svuotalo». Confonderli cancellerebbe
 *    la composizione a ogni rinomina del gruppo, in silenzio.
 */
type GruppoProdottiInput = {
  gruppoProdottiId?: number | null;
  codice: string;
  nome: string;
  colore?: string | null;
  ordinamento?: number | null;
  attivo: boolean;
  membri?: MembroGruppoInput[] | null;
};

type MembroGruppoInput = {
  prodottoId: number;
  ordinamento: number;
};
