// Cash Register Type Definitions - Versione Italiana con alias retrocompatibili

type TipoDenominazioneMoneta = "COIN" | "BANKNOTE";
type StatoRegistroCassa = "DRAFT" | "CLOSED" | "RECONCILED";

// DenominazioneMoneta con alias inglesi per retrocompatibilità
type DenominazioneMoneta = {
  __typename: "DenominazioneMoneta";
  // Campi italiani (da GraphQL)
  id: number;
  valore: number;
  tipo: TipoDenominazioneMoneta;
  ordineVisualizzazione: number;
  // Alias inglesi per retrocompatibilità
  denominationId?: number;
  value?: number;
  type?: TipoDenominazioneMoneta;
  displayOrder?: number;
};

// ConteggioMoneta con alias inglesi per retrocompatibilità
type ConteggioMoneta = {
  __typename: "ConteggioMoneta";
  // Campi italiani (da GraphQL)
  id: number;
  registroCassaId: number;
  denominazioneMonetaId: number;
  denominazione: DenominazioneMoneta;
  quantita: number;
  totale: number;
  isApertura: boolean;
  // Alias inglesi per retrocompatibilità
  countId?: number;
  registerId?: number;
  denominationId?: number;
  quantity?: number;
  total?: number;
  isOpening?: boolean;
};

// IncassoCassa con alias inglesi per retrocompatibilità
type IncassoCassa = {
  __typename: "IncassoCassa";
  // Campi italiani (da GraphQL)
  id: number;
  registroCassaId: number;
  tipo: string;
  importo: number;
  // Alias inglesi per retrocompatibilità
  incomeId?: number;
  registerId?: number;
  type?: string;
  amount?: number;
};

// SpesaCassa con alias inglesi per retrocompatibilità
type SpesaCassa = {
  __typename: "SpesaCassa";
  // Campi italiani (da GraphQL)
  id: number;
  registroCassaId: number;
  descrizione: string;
  importo: number;
  // Alias inglesi per retrocompatibilità
  expenseId?: number;
  registerId?: number;
  description?: string;
  amount?: number;
};

// RegistroCassa con alias inglesi per retrocompatibilità
type RegistroCassa = {
  __typename: "RegistroCassa";
  // Campi italiani (da GraphQL)
  id: number;
  data: string;
  utenteId: number;
  utente: Utente;
  conteggiApertura: ConteggioMoneta[];
  conteggiChiusura: ConteggioMoneta[];
  incassi: IncassoCassa[];
  spese: SpesaCassa[];
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
  // Alias inglesi per retrocompatibilità
  registerId?: number;
  date?: string;
  openingCounts?: ConteggioMoneta[];
  closingCounts?: ConteggioMoneta[];
  incomes?: IncassoCassa[];
  expenses?: SpesaCassa[];
  openingTotal?: number;
  closingTotal?: number;
  cashSales?: number;
  cashInWhite?: number;
  electronicPayments?: number;
  invoicePayments?: number;
  totalSales?: number;
  supplierExpenses?: number;
  dailyExpenses?: number;
  expectedCash?: number;
  difference?: number;
  netCash?: number;
  vatAmount?: number;
  notes?: string | null;
  status?: StatoRegistroCassa;
  createdAt?: string;
  updatedAt?: string;
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
  // Alias inglesi per retrocompatibilità
  todaySales?: number;
  todayDifference?: number;
  monthSales?: number;
  monthAverage?: number;
  weekTrend?: number;
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
  // Alias inglesi per retrocompatibilità
  month?: string;
  year?: number;
  totalSales?: number;
  totalCash?: number;
  totalElectronic?: number;
  averageDaily?: number;
  daysWithDifferences?: number;
  totalVat?: number;
  registers?: RegistroCassa[];
};

// Pagination info
type PaginazioneCassaInfo = {
  haProssimaPagina: boolean;
  cursoreFine: string | null;
  haPaginaPrecedente: boolean;
  cursoreInizio: string | null;
  // Alias inglesi per retrocompatibilità
  hasNextPage?: boolean;
  endCursor?: string | null;
  hasPreviousPage?: boolean;
  startCursor?: string | null;
};

// Connection type for paginated results
type RegistroCassaConnection = {
  conteggioTotale: number;
  infoPaginazione: PaginazioneCassaInfo;
  elementi: RegistroCassa[];
  // Alias inglesi per retrocompatibilità
  totalCount?: number;
  pageInfo?: PaginazioneCassaInfo;
  edges?: Array<{ node: RegistroCassa; cursor: string }>;
};

// Legacy type aliases for backward compatibility during transition
type CashDenominationType = TipoDenominazioneMoneta;
type CashRegisterStatus = StatoRegistroCassa;
type CashDenomination = DenominazioneMoneta;
type CashCount = ConteggioMoneta;
type CashIncome = IncassoCassa;
type CashExpense = SpesaCassa;
type CashRegister = RegistroCassa;
type CashRegisterKPI = RegistroCassaKPI;
type MonthlyCashSummary = RiepilogoMensileCassa;
type FormikCashCountValues = FormikConteggioMonetaValues;
type FormikCashRegisterValues = FormikRegistroCassaValues;
