/**
 * I tre modi in cui si incassa una consumazione — e, cosa che conta di più, i tre **secchi**
 * del registro in cui il denaro finisce. Le stringhe sono quelle del server
 * (`MetodiPagamentoVendita`), confrontate in modo **ordinale**: `"elettronico"` minuscolo
 * verrebbe rifiutato.
 */
type MetodoPagamentoVendita = "ELETTRONICO" | "CONTANTE_TRACCIATO" | "CONTANTE_NON_TRACCIATO";

/**
 * Il prodotto come lo vede il **banco**: il minimo per disegnare un pulsante e battere una riga.
 * Più stretto di [[ProdottoCassa]] di proposito — e la query che lo alimenta filtra su `attivo`,
 * perché un prodotto disattivato non si vende e il suo pulsante non deve esistere.
 */
type ProdottoVendibile = {
  __typename?: "Prodotto";
  prodottoId: number;
  codice: string;
  nome: string;
  prezzo: number;
  categoria?: string | null;
  aliquotaIva: number;
  /**
   * Ordine della tessera dentro la sua categoria. `0` = «mai ordinato», in coda per codice.
   */
  ordinamento?: number;
  /**
   * Colore editoriale della bevanda, che **vince** su quello generato dalla categoria.
   * ⚠️ Non è `ordinamentoVetrina` né un campo di vetrina: appartiene alla cassa.
   */
  colore?: string | null;
};

/** Una consumazione battuta, con lo snapshot IVA che il server calcola alla creazione. */
type Vendita = {
  __typename?: "Vendita";
  venditaId: number;
  registroCassaId: number;
  /**
   * L'ordine da cui questa riga è nata. `null` solo sulle righe di sviluppo battute col vecchio
   * regime, quando `creaVendita` esisteva ancora.
   *
   * 🔴 **È il campo che dice se la riga si può ancora toccare**: con un ordine dietro,
   *    `aggiornaVendita` ed `eliminaVendita` la rifiutano — si passa da `stornaOrdine`, che è
   *    l'unico modo di disfare un incasso senza muovere i secchi una seconda volta.
   */
  ordineId?: number | null;
  prodottoId: number;
  quantita: number;
  prezzoUnitario: number;
  prezzoTotale: number;
  /** Aliquota in PERCENTUALE (es. `10` = 10%), copiata dal prodotto al momento della vendita. */
  aliquotaIva: number;
  imponibile: number;
  importoIva: number;
  note?: string | null;
  dataOra: string;
  metodoPagamento: MetodoPagamentoVendita;
  createdAt: string;
  updatedAt: string;
  prodotto?: { prodottoId: number; codice: string; nome: string } | null;
};

/*
 * 🔴 **`CreaVenditaInput` non esiste più.** Non c'è più alcuna porta che crei una vendita
 *    direttamente: una vendita nasce solo dalla chiusura di un ordine, dove la guardia della
 *    transizione garantisce che i secchi si muovano una volta sola. Vedi `ordine.d.ts`.
 */

type AggiornaVenditaInput = {
  prodottoId?: number | null;
  quantita?: number | null;
  note?: string | null;
  /** `null` lascia il metodo esistente; un valore lo sposta **da un secchio all'altro**. */
  metodoPagamento?: MetodoPagamentoVendita | null;
};
