// src/@types/MonthlyClosure.d.ts

type CodiceMotivo = "ATTIVITA_NON_AVVIATA" | "CHIUSURA_PROGRAMMATA" | "EVENTO_ECCEZIONALE";

type GiornoEscluso = {
  data: string;
  codiceMotivo: CodiceMotivo;
  note?: string;
  dataEsclusione: string;
  utenteEsclusione: number;
};

// `CategoriaSpesa` è definita in sede condivisa in @types/RegistroCassa.d.ts.

type StatoChiusuraMensile = "BOZZA" | "CHIUSA" | "RICONCILIATA";

// Sottoinsieme dei campi del registro cassa esposti sulla chiusura mensile
// (fragment RegistroCassaMensileFragment). Contiene tutti i campi necessari a
// `aggregaRegistriPerMese` per calcolare i KPI gestionali della chiusura.
type RegistroCassaMensileRidotto = {
  __typename?: "RegistroCassa";
  id: number;
  data: string;
  totaleVendite: number;
  incassoContanteTracciato: number;
  incassiElettronici: number;
  incassiFattura: number;
  resto: number;
  stato: StatoRegistroCassa;
  totaleApertura: number;
  totaleChiusura: number;
  speseFornitori: number;
  speseGiornaliere: number;
  spese: SpesaCassaRidotta[];
  pagamentiFornitori: PagamentoFornitoreRidotto[];
};

/** Riga di spesa non tracciata del giorno. La data è quella del registro genitore. */
type SpesaCassaRidotta = {
  id: number;
  descrizione: string;
  importo: number;
  categoria: CategoriaSpesa;
  note: string | null;
};

/** Pagamento del giorno. `categoria` valorizzata = spesa fissa tracciata; null = documentale. */
type PagamentoFornitoreRidotto = {
  pagamentoId: number;
  fatturaId: number | null;
  ddtId: number | null;
  dataPagamento: string;
  importo: number;
  metodoPagamento: string | null;
  categoria: CategoriaSpesa | null;
  /** Causale della riga. Campo proprio; prima le spese fisse tracciate riusavano `note`. */
  descrizione: string | null;
  note: string | null;
};

type RegistroCassaMensile = {
  __typename: "RegistroCassaMensile";
  chiusuraId: number;
  registroId: number;
  incluso: boolean;
  registro: RegistroCassaMensileRidotto;
};

type ChiusuraMensile = {
  __typename: "ChiusuraMensile";
  chiusuraId: number;
  anno: number;
  mese: number;
  // Proprietà calcolate (pura aggregazione dei registri inclusi, compute on-the-fly dal backend)
  ricavoTotaleCalcolato: number;
  totaleContantiCalcolato: number;
  totaleElettroniciCalcolato: number;
  totaleFattureCalcolato: number;
  // Spese tracciate (Σ SpeseFornitori) e non tracciate (Σ SpeseGiornaliere) dei registri inclusi.
  speseTracciateRegistriCalcolate: number;
  speseGiornaliereRegistriCalcolate: number;
  ricavoNettoCalcolato: number;
  totaleIvaCalcolato: number;
  totaleImponibileCalcolato: number;
  totaleLordoCalcolato: number;
  totaleDifferenzeCassaCalcolato: number;

  // Avvisi non bloccanti valorizzati solo nel payload di chiudiChiusuraMensile
  avvisiCompletezza: string[] | null;

  // Relazioni (chiusura = pura aggregazione dei soli registri inclusi)
  registriInclusi: RegistroCassaMensile[];

  giorniEsclusi: string | null;

  stato: StatoChiusuraMensile;
  note: string | null;
  chiusaDa: number | null;
  chiusaDaUtente: User | null;
  chiusaIl: string | null;
  createdAt: string;
  updatedAt: string;
};
