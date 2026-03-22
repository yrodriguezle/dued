// Cash Register Type Definitions - Versione Italiana

// Summary types for cross-grid aggregation
interface IncomeEntry {
  type: string;
  amount: number;
}

interface SummaryData {
  openingTotal: number;
  closingTotal: number;
  incomes: IncomeEntry[];
  expensesTotalAmount: number;     // AC: tutte le spese (fornitori + scontrino)
  receiptExpensesAmount: number;   // AF: solo spese scontrino (non fornitori)
}

type TipoDenominazioneMoneta = "COIN" | "BANKNOTE";
type StatoRegistroCassa = "DRAFT" | "CLOSED" | "RECONCILED";

// DenominazioneMoneta
type DenominazioneMoneta = {
  __typename: "DenominazioneMoneta";
  id: number;
  valore: number;
  tipo: TipoDenominazioneMoneta;
  ordineVisualizzazione: number;
};

// ConteggioMoneta
type ConteggioMoneta = {
  __typename: "ConteggioMoneta";
  id: number;
  registroCassaId: number;
  denominazioneMonetaId: number;
  denominazione: DenominazioneMoneta;
  quantita: number;
  totale: number;
  isApertura: boolean;
};

// IncassoCassa
type IncassoCassa = {
  __typename: "IncassoCassa";
  id: number;
  registroCassaId: number;
  tipo: string;
  importo: number;
};

// SpesaCassa
type SpesaCassa = {
  __typename: "SpesaCassa";
  id: number;
  registroCassaId: number;
  descrizione: string;
  importo: number;
};

// PagamentoFornitoreRegistro
type PagamentoFornitoreRegistro = {
  pagamentoId: number;
  importo: number;
  metodoPagamento?: string;
  dataPagamento?: string;
  note?: string;
  ddt?: {
    ddtId: number;
    numeroDdt: string;
    dataDdt?: string;
    importo?: number;
    fornitore: {
      fornitoreId: number;
      ragioneSociale: string;
    };
  };
  fattura?: {
    fatturaId: number;
    numeroFattura: string;
    dataFattura?: string;
    imponibile?: number;
    stato?: string;
    fornitore: {
      fornitoreId: number;
      ragioneSociale: string;
    };
  };
};

// RegistroCassa
type RegistroCassa = {
  __typename: "RegistroCassa";
  id: number;
  data: string;
  utenteId: number;
  utente: Utente;
  conteggiApertura: ConteggioMoneta[];
  conteggiChiusura: ConteggioMoneta[];
  incassi: IncassoCassa[];
  spese: SpesaCassa[];
  pagamentiFornitori: PagamentoFornitoreRegistro[];
  totaleApertura: number;
  totaleChiusura: number;
  venditeContanti: number;
  incassoContanteTracciato: number;
  incassiElettronici: number;
  incassiFattura: number;
  totaleVendite: number;
  speseFornitori: number;
  speseGiornaliere: number;
  contanteAtteso: number;
  differenza: number;
  contanteNetto: number;
  importoIva: number;
  note: string | null;
  stato: StatoRegistroCassa;
  creatoIl: string;
  aggiornatoIl: string;
};

// Form values for Formik
type FormikConteggioMonetaValues = {
  denominazioneMonetaId: number;
  quantita: number;
};

type FormikRegistroCassaValues = {
  id?: number;
  data: string;
  utenteId: number;
  conteggiApertura: FormikConteggioMonetaValues[];
  conteggiChiusura: FormikConteggioMonetaValues[];
  speseFornitori: number;
  speseGiornaliere: number;
  note: string;
  stato: StatoRegistroCassa;
};

// Dashboard KPIs
type RegistroCassaKPI = {
  venditeOggi: number;
  differenzaOggi: number;
  venditeMese: number;
  mediaMese: number;
  trendSettimana: number;
};

// Monthly summary
type RiepilogoMensileCassa = {
  mese: string;
  anno: number;
  totaleVendite: number;
  totaleContanti: number;
  totaleElettronici: number;
  mediaGiornaliera: number;
  giorniConDifferenze: number;
  totaleIva: number;
  registri: RegistroCassa[];
};

// Pagination info
type PaginazioneCassaInfo = {
  haProssimaPagina: boolean;
  cursoreFine: string | null;
  haPaginaPrecedente: boolean;
  cursoreInizio: string | null;
};

// Connection type for paginated results
type RegistroCassaConnection = {
  conteggioTotale: number;
  infoPaginazione: PaginazioneCassaInfo;
  elementi: RegistroCassa[];
};

// === Tipi per le griglie del Registro Cassa ===

interface CashCount {
  denominazioneMonetaId: number;
  quantita: number;
}

interface Income extends Record<string, unknown> {
  type: string;
  amount: number;
}

interface Expense extends Record<string, unknown> {
  description: string;
  amount: number;
  isPagamentoFornitore?: boolean;
  fornitoreId?: number;
  ddtNumber?: string;
  paymentMethod?: string;
  documentType?: "FA" | "DDT";
  invoiceNumber?: string;
  pagamentoId?: number;
  fatturaId?: number;
  ddtId?: number;
  dataFattura?: string;
  dataDdt?: string;
}

interface CashCountRow extends Record<string, unknown> {
  denominationId: number;
  type: "COIN" | "BANKNOTE";
  value: number;
  quantity: number;
  total: number;
}

interface IncomeRow extends Record<string, unknown> {
  type: string;
  amount: number;
}

interface ExpenseRow extends Record<string, unknown> {
  description: string;
  amount: number;
}
