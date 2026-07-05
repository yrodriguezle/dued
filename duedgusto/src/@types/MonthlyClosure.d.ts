// src/@types/MonthlyClosure.d.ts

type CodiceMotivo = "ATTIVITA_NON_AVVIATA" | "CHIUSURA_PROGRAMMATA" | "EVENTO_ECCEZIONALE";

type GiornoEscluso = {
  data: string;
  codiceMotivo: CodiceMotivo;
  note?: string;
  dataEsclusione: string;
  utenteEsclusione: number;
};

type CategoriaSpesa = "Affitto" | "Utenze" | "Stipendi" | "Altro";

type StatoChiusuraMensile = "BOZZA" | "CHIUSA" | "RICONCILIATA";

type SpesaMensileLibera = {
  __typename: "SpesaMensileLibera";
  spesaId: number;
  chiusuraId: number;
  descrizione: string;
  importo: number;
  categoria: CategoriaSpesa;
  // Giorno di competenza della spesa nel mese della chiusura (nullable).
  data: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  differenza: number;
  stato: StatoRegistroCassa;
  totaleApertura: number;
  totaleChiusura: number;
  speseFornitori: number;
  speseGiornaliere: number;
};

type RegistroCassaMensile = {
  __typename: "RegistroCassaMensile";
  chiusuraId: number;
  registroId: number;
  incluso: boolean;
  registro: RegistroCassaMensileRidotto;
};

type PagamentoMensileFornitori = {
  __typename: "PagamentoMensileFornitori";
  chiusuraId: number;
  pagamentoId: number;
  inclusoInChiusura: boolean;
  pagamento: {
    pagamentoId: number;
    dataPagamento: string;
    importo: number;
    metodoPagamento: string | null;
    note: string | null;
    // null = origine-chiusura (editabile), valorizzato = origine cassa (read-only)
    registroCassaId: number | null;
    fatturaId: number | null;
    ddtId: number | null;
  };
};

type ChiusuraMensile = {
  __typename: "ChiusuraMensile";
  chiusuraId: number;
  anno: number;
  mese: number;
  // Proprietà calcolate (compute on-the-fly dal backend)
  ricavoTotaleCalcolato: number;
  totaleContantiCalcolato: number;
  totaleElettroniciCalcolato: number;
  totaleFattureCalcolato: number;
  speseAggiuntiveCalcolate: number;
  speseGiornaliereRegistriCalcolate: number;
  ricavoNettoCalcolato: number;
  totaleIvaCalcolato: number;
  totaleImponibileCalcolato: number;
  totaleLordoCalcolato: number;
  totaleDifferenzeCassaCalcolato: number;

  // Campi calcolati gestionali anti-doppio-conteggio (headline vista chiusura)
  speseAggiuntiveNonDuplicateCalcolate: number;
  totaleSpeseCalcolato: number;
  differenzaCalcolata: number;
  // Avvisi non bloccanti valorizzati solo nel payload di chiudiChiusuraMensile
  avvisiCompletezza: string[] | null;

  // Relazioni
  registriInclusi: RegistroCassaMensile[];
  speseLibere: SpesaMensileLibera[];
  pagamentiInclusi: PagamentoMensileFornitori[];

  giorniEsclusi: string | null;

  stato: StatoChiusuraMensile;
  note: string | null;
  chiusaDa: number | null;
  chiusaDaUtente: User | null;
  chiusaIl: string | null;
  createdAt: string;
  updatedAt: string;
};
