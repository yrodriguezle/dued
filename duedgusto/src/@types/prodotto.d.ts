/**
 * Un prodotto visto dalla **cassa**: il listino operativo.
 *
 * 🔴 Non contiene alcun campo di vetrina, e non è una semplificazione. `UpsertProdottoAsync`
 *    assegna esplicitamente ogni campo che riceve, quindi un input di cassa che portasse con sé
 *    i campi del sito li azzererebbe in massa su tutti i prodotti al primo salvataggio. I due
 *    insiemi hanno due scrittori distinti — `mutateProdotto` qui, `mutateProdottoVetrina` di là —
 *    ed è il confine che rende sicura l'assegnazione totale in entrambi.
 *    Per la forma con i campi del sito vedi `ProdottoVetrina` in `vetrina.d.ts`.
 */
type ProdottoCassa = {
  __typename?: "Prodotto";
  prodottoId: number;
  /** Chiave del listino, **univoca**. ⚠️ Non esiste una mutation che elimini un prodotto: un codice sbagliato resta. */
  codice: string;
  nome: string;
  descrizione?: string | null;
  prezzo: number;
  /** Categoria **contabile**, per i raggruppamenti di cassa. Non è `categoriaVetrina`, che è come il piatto si presenta al cliente. */
  categoria?: string | null;
  unitaDiMisura: string;
  /**
   * Stato di vendita in cassa. ⚠️ È anche l'interruttore generale del sito: il derivato
   * `pubblicatoSulSito` è `visibileSulSito && attivo`, quindi disattivare un prodotto per il
   * bancone lo toglie **anche** dal menu pubblico.
   */
  attivo: boolean;
  /** Aliquota in PERCENTUALE (es. `10` = 10%), non in frazione. Ammesse: 0, 4, 5, 10, 22. */
  aliquotaIva: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * L'input di `mutateProdotto`: upsert per `prodottoId` (assente o `0` = creazione).
 * Rispecchia `ProdottoInput` lato server — e come quello **non ha** campi di vetrina.
 */
type ProdottoCassaInput = {
  prodottoId?: number | null;
  codice: string;
  nome: string;
  descrizione?: string | null;
  prezzo: number;
  categoria?: string | null;
  unitaDiMisura?: string | null;
  attivo: boolean;
  aliquotaIva: number;
};
