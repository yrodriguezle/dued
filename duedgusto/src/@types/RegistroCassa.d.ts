// Cash Register Type Definitions - Versione Italiana

interface IncassiGiornalieri {
  tipo: string;
  importo: number;
}

interface RiepilogoGiornaliero {
  totaleApertura: number;
  totaleChiusura: number;
  incassi: IncassiGiornalieri[];
  totaleSpese: number;        // AC: tutte le spese (fornitori + scontrino)
  speseScontrino: number;     // AF: solo spese scontrino (non fornitori)
}

type TipoDenominazioneMoneta = "COIN" | "BANKNOTE";
type StatoRegistroCassa = "DRAFT" | "CLOSED" | "RECONCILED";

// Categoria di una spesa (registro cassa + chiusura mensile). Sede condivisa:
// usata dalla colonna Categoria della griglia spese del registro e della chiusura.
type CategoriaSpesa = "Affitto" | "Utenze" | "Stipendi" | "Altro";

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

// SpesaCassa
type SpesaCassa = {
  __typename: "SpesaCassa";
  id: number;
  registroCassaId: number;
  descrizione: string;
  importo: number;
  categoria: CategoriaSpesa;
};

// PagamentoFornitoreRegistro
type PagamentoFornitoreRegistro = {
  pagamentoId: number;
  importo: number;
  metodoPagamento?: string;
  dataPagamento?: string;
  note?: string;
  // Categoria (nullable): valorizzata solo per le spese fisse pagate in modo tracciato.
  categoria?: CategoriaSpesa | null;
  ddt?: {
    ddtId: number;
    numeroDdt: string;
    dataDdt?: string;
    importo?: number;
    fornitore: {
      fornitoreId: number;
      ragioneSociale: string;
      aliquotaIva?: number | null;
    };
  };
  fattura?: {
    fatturaId: number;
    numeroFattura: string;
    dataFattura?: string;
    imponibile?: number;
    totaleConIva?: number | null;
    stato?: string;
    fornitore: {
      fornitoreId: number;
      ragioneSociale: string;
      aliquotaIva?: number | null;
    };
  };
};

// RegistroCassaIvaRiga — riga del breakdown IVA a debito (vendite) per aliquota
type RegistroCassaIvaRiga = {
  __typename: "RegistroCassaIva";
  aliquota: number;
  imponibile: number;
  imposta: number;
  stimato: boolean;
};

// RegistroCassaIvaCreditoRiga — riga IVA a credito (acquisti), dato gestionale di cassa
// Fonte: "FATTURA" (dato certo) | "DDT" (stima, nessuna fattura). aliquotaMista = fattura multi-aliquota.
type RegistroCassaIvaCreditoRiga = {
  __typename: "RegistroCassaIvaCredito";
  aliquota: number;
  imponibile: number;
  imposta: number;
  fonte: "FATTURA" | "DDT";
  stimato: boolean;
  aliquotaMista: boolean;
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
  breakdownIva: RegistroCassaIvaRiga[];
  breakdownIvaCredito: RegistroCassaIvaCreditoRiga[];
  note: string | null;
  stato: StatoRegistroCassa;
  createdAt: string;
  updatedAt: string;
};

// Sottoinsieme strutturale dei campi di RegistroCassa necessari ad
// `aggregaRegistriPerMese`. RegistroCassa (completo) e i registri ridotti
// esposti sulla chiusura mensile sono entrambi assegnabili a questo tipo.
type RegistroCassaAggregabile = Pick<
  RegistroCassa,
  | "data"
  | "totaleApertura"
  | "totaleChiusura"
  | "incassoContanteTracciato"
  | "incassiElettronici"
  | "incassiFattura"
  | "totaleVendite"
  | "speseFornitori"
  | "speseGiornaliere"
  | "stato"
>;

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

// === Contratto dati Dashboard Cassa (change: dashboard-charts-redesign) ===

// Riepilogo mensile normalizzato per la dashboard (12 elementi garantiti, mese 1-12).
// I campi derivati (totaleSpese, differenza) sono calcolati SOLO client-side in
// src/common/registroCassa/aggregaRegistri.tsx, mai richiesti al server.
type RiepilogoMeseDashboard = {
  anno: number;
  mese: number; // 1-12
  totaleVendite: number;
  ricavoTracciato: number; // Σ incassoContanteTracciato + incassiElettronici + incassiFattura
  ricavoNonTracciato: number; // Σ (totaleChiusura - totaleApertura) - incassoContanteTracciato
  speseTracciate: number; // Σ speseFornitori
  speseNonTracciate: number; // Σ speseGiornaliere
  incassoContanteTracciato: number;
  incassiElettronici: number;
  incassiFattura: number;
  registri: number;
  chiusi: number; // stato CLOSED o RECONCILED
  bozze: number; // stato DRAFT
  // Derivati client (aggregaRegistri/derivaTotali)
  totaleSpese: number; // speseTracciate + speseNonTracciate
  differenza: number; // totaleVendite - totaleSpese
};

// Contratto unico consumato dai componenti della dashboard.
type RiepilogoDashboard = {
  anno: number;
  mesi: RiepilogoMeseDashboard[]; // sempre 12, indicizzati mese-1
  totaliAnno: Omit<RiepilogoMeseDashboard, "mese">;
  meseCorrente: RiepilogoMeseDashboard | null; // solo se anno === anno corrente
  fonte: "server" | "adapter"; // per banner/log diagnostico
};

// Payload server della query gestioneCassa.riepilogoAnnuale(anno) — senza derivati client.
type RiepilogoMeseCassaServer = Omit<RiepilogoMeseDashboard, "totaleSpese" | "differenza"> & {
  __typename?: "RiepilogoMeseCassa";
};

type RiepilogoAnnualeCassaServer = {
  __typename?: "RiepilogoAnnualeCassa";
  anno: number;
  mesi: RiepilogoMeseCassaServer[]; // esattamente 12 lato server
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

interface Income {
  type: string;
  amount: number;
}

interface Spese {
  description: string;
  amount: number;
  categoria?: CategoriaSpesa;
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
  aliquotaIva?: number | null;
}

interface CashCountRow {
  denominationId: number;
  type: "COIN" | "BANKNOTE";
  value: number;
  quantity: number;
  total: number;
}

interface IncomeRow {
  type: string;
  amount: number;
}

interface ExpenseRow {
  description: string;
  amount: number;
}
