/**
 * Gli stati dell'ordine, nelle stesse stringhe del server (`backend/Common/StatiOrdine.cs`) e
 * confrontate in modo **ordinale**: `"aperto"` minuscolo verrebbe rifiutato.
 *
 * <p>La macchina è `APERTO → {CHIUSO | SPLITTATO | ANNULLATO}` e `CHIUSO → STORNATO`. Solo due
 * di questi stati hanno mosso i secchi del registro: `CHIUSO` li ha mossi, `STORNATO` li ha mossi
 * e poi disfatti. `SPLITTATO` **non** li ha mossi — li hanno mossi i suoi figli, che nascono già
 * `CHIUSO` — ed è la ragione per cui un padre splittato non si storna: si stornano i figli.</p>
 */
type StatoOrdine = "APERTO" | "CHIUSO" | "ANNULLATO" | "SPLITTATO" | "STORNATO";

/**
 * Una voce battuta dentro un ordine.
 *
 * ⚠️ **Non è una vendita.** Finché l'ordine è `APERTO` questa riga non ha mosso alcun secchio e
 *    non esiste alcuna [[Vendita]] corrispondente: si può togliere, cambiare di quantità e
 *    rifare, perché non c'è ancora un incasso da spiegare.
 *
 * `prezzoUnitario` e `aliquotaIva` sono lo snapshot preso **quando la voce è stata battuta** — il
 * prezzo detto al cliente — e la `Vendita` li eredita alla chiusura: un ritocco di listino a
 * ordine aperto non cambia il conto sotto al cliente.
 */
type RigaOrdine = {
  __typename?: "RigaOrdine";
  rigaOrdineId: number;
  ordineId: number;
  prodottoId: number;
  /** `decimal` lato server, non un intero: mezze porzioni e pesi sono ammessi. */
  quantita: number;
  prezzoUnitario: number;
  prezzoTotale: number;
  /** Aliquota in PERCENTUALE (es. `10` = 10%), congelata al tocco. */
  aliquotaIva: number;
  note?: string | null;
  dataOra: string;
  prodotto?: { prodottoId: number; codice: string; nome: string } | null;
};

/**
 * Il conto al bancone.
 *
 * 🔴 **Niente `resto` qui**, e non è una dimenticanza: si legge `contanteRicevuto` e il resto da
 *    rendere è la sottrazione `contanteRicevuto − totale`, fatta dal client. `RegistroCassa.resto`
 *    esiste già ed è la colonna AG del foglio di chiusura («Ecc al netto delle spese con
 *    scontrino»): riusare quel nome qui creerebbe in UI un equivoco che poi non si toglie più.
 */
type Ordine = {
  __typename?: "Ordine";
  ordineId: number;
  registroCassaId: number;
  /** Derivato dal server: `{data:yyMMdd}-{numero:D3}[-{suffisso}]`. Mai persistito. */
  identificativo: string;
  /**
   * 🔴 La data del **registro**, non quella di apertura. Un ordine aperto alle 23:50 e ancora
   *    aperto alle 00:05 appartiene al registro di **ieri**: questo campo è ciò che permette
   *    all'operatore di vederlo, invece di cercarlo fra gli ordini di oggi.
   */
  dataRegistro: string;
  numero: number;
  /** `""` se l'ordine non è splittato, `"A"`/`"B"`/… sui figli di uno split. Mai `null`. */
  suffissoSplit: string;
  stato: StatoOrdine;
  /** `null` finché l'ordine è aperto, e anche su un padre `SPLITTATO`: non ha incassato lui. */
  metodoPagamento?: MetodoPagamentoVendita | null;
  /** Snapshot scritto **alla chiusura**: su un ordine aperto vale ancora 0. */
  totaleOrdine: number;
  /** Somma delle voci di adesso: è il totale da mostrare mentre l'ordine è `APERTO`. */
  totaleCorrente: number;
  /** Quanto ha dato il cliente. Aiuto all'operatore, non un dato contabile: non muove secchi. */
  contanteRicevuto?: number | null;
  ordinePadreId?: number | null;
  righe: RigaOrdine[];
  apertoIl: string;
  chiusoIl?: string | null;
  annullatoIl?: string | null;
  stornatoIl?: string | null;
  motivoAnnullamento?: string | null;
  motivoStorno?: string | null;
};

/**
 * Una delle parti in cui si chiude un ordine: **un metodo e le voci pagate con quel metodo**.
 *
 * 🔴 **Le voci, non un importo.** Non esiste un campo `importo`, e non è un'omissione: la
 *    divisione per importo sullo stesso insieme di voci («30 € totali, 20 in contanti e 10 con
 *    carta») non è supportata, e qui non è nemmeno *esprimibile*. Il limite va detto **in
 *    pagina**, prima che l'operatore ci arrivi alla cassa.
 */
type TaglioOrdineInput = {
  metodoPagamento: MetodoPagamentoVendita;
  /**
   * Le righe che finiscono in questa parte. Insieme agli altri tagli devono partizionare
   * l'ordine **esattamente**: nessuna voce fuori, nessuna voce in due parti.
   */
  righeOrdineId: number[];
  /**
   * Quanto ha dato il cliente, solo per i metodi in contanti. `null`/assente significa «importo
   * esatto», ed è il caso normale.
   */
  contanteRicevuto?: number | null;
};

/** L'ingresso di `chiudiOrdine`: 1 taglio = chiusura semplice, 2..n = split. */
type ChiudiOrdineInput = {
  ordineId: number;
  tagli: TaglioOrdineInput[];
};

/** L'esito della chiusura. `ordiniGenerati` è vuoto per una chiusura semplice. */
type EsitoChiusuraOrdine = {
  __typename?: "EsitoChiusuraOrdine";
  ordine: Ordine;
  ordiniGenerati: Ordine[];
  /**
   * 🔴 «Resto da rendere», mai «resto» da solo. Derivato dal server, mai persistito, e senza
   *    alcun effetto contabile.
   */
  restoDaRendere: number;
};
