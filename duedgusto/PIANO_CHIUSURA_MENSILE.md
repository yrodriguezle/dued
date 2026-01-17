# Piano Implementazione - Chiusura Mensile e Gestione Fornitori

## Obiettivo
Creare un sistema completo di chiusura mensile con gestione fornitori, fatture di acquisto, DDT e pagamenti che si integra con la cassa giornaliera esistente.

---

## 1. STRUTTURA DATABASE

### 1.1 Nuove Tabelle

#### Tabella: `Fornitori`
```sql
CREATE TABLE Fornitori (
  FornitoreId SERIAL PRIMARY KEY,
  RagioneSociale VARCHAR(255) NOT NULL,
  PartitaIva VARCHAR(20) UNIQUE,
  CodiceFiscale VARCHAR(16),
  Indirizzo TEXT,
  Citta VARCHAR(100),
  Cap VARCHAR(10),
  Paese VARCHAR(2) DEFAULT 'IT',
  Email VARCHAR(255),
  Telefono VARCHAR(50),
  Note TEXT,
  Attivo BOOLEAN DEFAULT true,
  CreatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  AggiornatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabella: `FattureAcquisto` (Fatture di Acquisto)
```sql
CREATE TABLE FattureAcquisto (
  FatturaId SERIAL PRIMARY KEY,
  FornitoreId INTEGER NOT NULL REFERENCES Fornitori(FornitoreId),
  NumeroFattura VARCHAR(50) NOT NULL,
  DataFattura DATE NOT NULL,
  DataScadenza DATE,
  Imponibile DECIMAL(10,2) NOT NULL,
  ImportoIva DECIMAL(10,2),
  TotaleConIva DECIMAL(10,2),
  Stato VARCHAR(20) DEFAULT 'DA_PAGARE', -- DA_PAGARE, PARZIALMENTE_PAGATA, PAGATA
  Note TEXT,
  CreatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  AggiornatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(FornitoreId, NumeroFattura)
);
```

#### Tabella: `DocumentiTrasporto` (DDT)
```sql
CREATE TABLE DocumentiTrasporto (
  DdtId SERIAL PRIMARY KEY,
  FatturaId INTEGER REFERENCES FattureAcquisto(FatturaId),
  FornitoreId INTEGER NOT NULL REFERENCES Fornitori(FornitoreId),
  NumeroDdt VARCHAR(50) NOT NULL,
  DataDdt DATE NOT NULL,
  Importo DECIMAL(10,2),
  Note TEXT,
  CreatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  AggiornatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(FornitoreId, NumeroDdt)
);
```

#### Tabella: `PagamentiFornitori`
```sql
CREATE TABLE PagamentiFornitori (
  PagamentoId SERIAL PRIMARY KEY,
  FatturaId INTEGER REFERENCES FattureAcquisto(FatturaId),
  DdtId INTEGER REFERENCES DocumentiTrasporto(DdtId),
  DataPagamento DATE NOT NULL,
  Importo DECIMAL(10,2) NOT NULL,
  MetodoPagamento VARCHAR(50), -- CONTANTI, BONIFICO, ASSEGNO, etc.
  Note TEXT,
  CreatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  AggiornatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Vincolo: deve avere almeno FatturaId O DdtId
  CONSTRAINT chk_pagamento_riferimento CHECK (
    FatturaId IS NOT NULL OR DdtId IS NOT NULL
  )
);
```

#### Tabella: `ChiusureMensili`
```sql
CREATE TABLE ChiusureMensili (
  ChiusuraId SERIAL PRIMARY KEY,
  Anno INTEGER NOT NULL,
  Mese INTEGER NOT NULL CHECK (Mese >= 1 AND Mese <= 12),
  UltimoGiornoLavorativo DATE NOT NULL,

  -- Riepilogo incassi (dalla lista cash register)
  RicavoTotale DECIMAL(10,2),
  TotaleContanti DECIMAL(10,2),
  TotaleElettronici DECIMAL(10,2),
  TotaleFatture DECIMAL(10,2),

  -- Spese mensili aggiuntive
  SpeseAggiuntive DECIMAL(10,2) DEFAULT 0,

  -- Totali finali
  RicavoNetto DECIMAL(10,2), -- RicavoTotale - SpeseAggiuntive

  Stato VARCHAR(20) DEFAULT 'BOZZA', -- BOZZA, CHIUSA, RICONCILIATA
  Note TEXT,
  ChiusaDa INTEGER REFERENCES Users(UserId),
  ChiusaIl TIMESTAMP,
  CreatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  AggiornatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(Anno, Mese)
);
```

#### Tabella: `SpeseMensili` (Spese Mensili Aggiuntive)
```sql
CREATE TABLE SpeseMensili (
  SpesaId SERIAL PRIMARY KEY,
  ChiusuraId INTEGER NOT NULL REFERENCES ChiusureMensili(ChiusuraId) ON DELETE CASCADE,
  PagamentoId INTEGER REFERENCES PagamentiFornitori(PagamentoId),
  Descrizione TEXT NOT NULL,
  Importo DECIMAL(10,2) NOT NULL,
  Categoria VARCHAR(50), -- FORNITORE, AFFITTO, UTENZE, ALTRO
  CreatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  AggiornatoIl TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 Relazioni Database

```
Fornitori (1) ──< (N) FattureAcquisto
Fornitori (1) ──< (N) DocumentiTrasporto
FattureAcquisto (1) ──< (N) DocumentiTrasporto
FattureAcquisto (1) ──< (N) PagamentiFornitori
DocumentiTrasporto (1) ──< (N) PagamentiFornitori
PagamentiFornitori (1) ──< (N) SpeseMensili
ChiusureMensili (1) ──< (N) SpeseMensili
```

---

## 2. STRUTTURA TYPESCRIPT (Frontend)

### 2.1 Nuovi Types (`src/@types/`)

#### `src/@types/Supplier.d.ts`
```typescript
type Supplier = {
  __typename: "Supplier";
  fornitoreId: number;
  ragioneSociale: string;
  partitaIva: string | null;
  codiceFiscale: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  paese: string;
  email: string | null;
  telefono: string | null;
  note: string | null;
  attivo: boolean;
  creatoIl: string;
  aggiornatoIl: string;
};

type SupplierInput = {
  ragioneSociale: string;
  partitaIva?: string;
  codiceFiscale?: string;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  paese?: string;
  email?: string;
  telefono?: string;
  note?: string;
  attivo?: boolean;
};
```

#### `src/@types/PurchaseInvoice.d.ts`
```typescript
type PurchaseInvoice = {
  __typename: "PurchaseInvoice";
  fatturaId: number;
  fornitoreId: number;
  fornitore: Supplier;
  numeroFattura: string;
  dataFattura: string;
  dataScadenza: string | null;
  imponibile: number;
  importoIva: number | null;
  totaleConIva: number | null;
  stato: "DA_PAGARE" | "PARZIALMENTE_PAGATA" | "PAGATA";
  note: string | null;
  documentiTrasporto: DeliveryNote[];
  pagamenti: SupplierPayment[];
  creatoIl: string;
  aggiornatoIl: string;
};

type PurchaseInvoiceInput = {
  fornitoreId: number;
  numeroFattura: string;
  dataFattura: string;
  dataScadenza?: string;
  imponibile: number;
  importoIva?: number;
  totaleConIva?: number;
  stato?: string;
  note?: string;
};
```

#### `src/@types/DeliveryNote.d.ts`
```typescript
type DeliveryNote = {
  __typename: "DeliveryNote";
  ddtId: number;
  fatturaId: number | null;
  fornitoreId: number;
  fornitore: Supplier;
  fattura: PurchaseInvoice | null;
  numeroDdt: string;
  dataDdt: string;
  importo: number | null;
  note: string | null;
  pagamenti: SupplierPayment[];
  creatoIl: string;
  aggiornatoIl: string;
};

type DeliveryNoteInput = {
  fatturaId?: number;
  fornitoreId: number;
  numeroDdt: string;
  dataDdt: string;
  importo?: number;
  note?: string;
};
```

#### `src/@types/SupplierPayment.d.ts`
```typescript
type SupplierPayment = {
  __typename: "SupplierPayment";
  pagamentoId: number;
  fatturaId: number | null;
  ddtId: number | null;
  fattura: PurchaseInvoice | null;
  ddt: DeliveryNote | null;
  dataPagamento: string;
  importo: number;
  metodoPagamento: string | null;
  note: string | null;
  creatoIl: string;
  aggiornatoIl: string;
};

type SupplierPaymentInput = {
  fatturaId?: number;
  ddtId?: number;
  dataPagamento: string;
  importo: number;
  metodoPagamento?: string;
  note?: string;
};
```

#### `src/@types/MonthlyClosure.d.ts`
```typescript
type MonthlyExpense = {
  __typename: "MonthlyExpense";
  spesaId: number;
  chiusuraId: number;
  pagamentoId: number | null;
  pagamento: SupplierPayment | null;
  descrizione: string;
  importo: number;
  categoria: string | null;
  creatoIl: string;
  aggiornatoIl: string;
};

type MonthlyClosure = {
  __typename: "MonthlyClosure";
  chiusuraId: number;
  anno: number;
  mese: number;
  ultimoGiornoLavorativo: string;

  // Riepilogo incassi
  ricavoTotale: number | null;
  totaleContanti: number | null;
  totaleElettronici: number | null;
  totaleFatture: number | null;

  // Spese mensili
  speseAggiuntive: number | null;
  spese: MonthlyExpense[];

  // Totali finali
  ricavoNetto: number | null;

  stato: "BOZZA" | "CHIUSA" | "RICONCILIATA";
  note: string | null;
  chiusaDa: number | null;
  chiusaDaUtente: User | null;
  chiusaIl: string | null;
  creatoIl: string;
  aggiornatoIl: string;
};

type MonthlyClosureInput = {
  anno: number;
  mese: number;
  ultimoGiornoLavorativo: string;
  ricavoTotale?: number;
  totaleContanti?: number;
  totaleElettronici?: number;
  totaleFatture?: number;
  speseAggiuntive?: number;
  ricavoNetto?: number;
  stato?: string;
  note?: string;
};

type MonthlyExpenseInput = {
  pagamentoId?: number;
  descrizione: string;
  importo: number;
  categoria?: string;
};
```

---

## 3. STRUTTURA COMPONENTI FRONTEND

### 3.1 Modulo Fornitori (`src/components/pages/suppliers/`)

```
suppliers/
├── SupplierList.tsx              ← Lista fornitori con toolbar (new, edit, delete)
├── SupplierDetails.tsx           ← Form dettagli fornitore (Formik + Zod)
├── SupplierForm.tsx              ← Form riutilizzabile
└── SupplierSearchbox.tsx         ← Searchbox per selezionare fornitore
```

### 3.2 Modulo Fatture Acquisto (`src/components/pages/purchases/`)

```
purchases/
├── PurchaseInvoiceList.tsx       ← Lista fatture acquisto
├── PurchaseInvoiceDetails.tsx    ← Dettagli fattura con DDT e pagamenti
├── PurchaseInvoiceForm.tsx       ← Form fattura
├── DeliveryNoteList.tsx          ← Lista DDT
├── DeliveryNoteDetails.tsx       ← Dettagli DDT
├── DeliveryNoteForm.tsx          ← Form DDT
├── SupplierPaymentList.tsx       ← Lista pagamenti fornitori
├── SupplierPaymentDetails.tsx    ← Dettagli pagamento
└── SupplierPaymentForm.tsx       ← Form pagamento
```

### 3.3 Modulo Chiusura Mensile (`src/components/pages/cashRegister/`)

```
cashRegister/
├── MonthlyClosureList.tsx        ← Lista chiusure mensili
├── MonthlyClosureDetails.tsx     ← Dettagli chiusura mensile
├── MonthlyClosureForm.tsx        ← Form chiusura
├── MonthlyExpensesDataGrid.tsx   ← Griglia spese mensili aggiuntive
└── MonthlySummaryView.tsx        ← Riepilogo mensile con calcoli
```

---

## 4. STRUTTURA GRAPHQL

### 4.1 Fragments (`src/graphql/`)

```
graphql/
├── suppliers/
│   ├── fragments.tsx             ← supplierFragment
│   ├── queries.tsx               ← getSuppliers, getSupplier
│   └── mutations.tsx             ← mutateSupplier, deleteSupplier
├── purchases/
│   ├── fragments.tsx             ← invoiceFragment, ddtFragment, paymentFragment
│   ├── queries.tsx               ← getInvoices, getDDTs, getPayments
│   └── mutations.tsx             ← mutateInvoice, mutateDDT, mutatePayment
└── monthlyClosure/
    ├── fragments.tsx             ← monthlyClosureFragment, monthlyExpenseFragment
    ├── queries.tsx               ← getMonthlyClosure, getMonthlyClosures
    └── mutations.tsx             ← mutateMonthlyClosure
```

---

## 5. FLUSSO OPERATIVO

### 5.1 Gestione Giornaliera (ESISTENTE)
1. Apertura cassa
2. Conteggio chiusura
3. Registrazione incassi (contanti, elettronici, fatture)
4. Registrazione spese giornaliere
5. Calcolo differenza/ECC
6. Salvataggio CashRegister

### 5.2 Gestione Fornitori (NUOVO)
1. Creazione anagrafica fornitore
2. Registrazione fattura di acquisto
3. Collegamento DDT a fattura (opzionale)
4. Registrazione pagamenti con data
5. Pagamenti automaticamente disponibili per chiusura mensile

### 5.3 Chiusura Mensile (NUOVO)

#### Step 1: Riepilogo Automatico
- Sistema calcola automaticamente da CashRegister:
  - `ricavoTotale` (somma ricavi giornalieri)
  - `totaleContanti` (somma pago in contanti)
  - `totaleElettronici` (somma elettronici)
  - `totaleFatture` (somma pagamenti fattura)

#### Step 2: Aggiunta Spese Mensili
- Utente apre chiusura mensile per mese/anno
- Griglia "Spese Mensili Aggiuntive" permette di:
  - Aggiungere pagamenti fornitori (seleziona da lista PagamentiFornitori del mese)
  - Aggiungere spese manuali (affitto, utenze, altro)
- Sistema calcola:
  - `speseAggiuntive` = somma spese griglia
  - `ricavoNetto` = `ricavoTotale - speseAggiuntive`

#### Step 3: Salvataggio
- Le spese vengono aggiunte all'ultimo giorno lavorativo del mese
- Stato: BOZZA → CHIUSA → RICONCILIATA
- Chiusura salvata con riferimento all'utente che l'ha chiusa

---

## 6. UI/UX - Vista Chiusura Mensile

### Layout MonthlyClosureDetails.tsx

```
┌─────────────────────────────────────────────────────────┐
│ CHIUSURA MENSILE - Gennaio 2025                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─ Riepilogo Incassi Mensili ──────────────────────┐   │
│ │ (Dati automatici da CashRegisterList)             │   │
│ │                                                    │   │
│ │ Ricavo Totale Mese:        € 10,245.50           │   │
│ │ Pago in Contanti:          €  3,450.00  [Verde]  │   │
│ │ Pagamenti Elettronici:     €  1,320.00  [Verde]  │   │
│ │ Totale Vendite:            € 14,015.50  [Giallo] │   │
│ │ Pagamenti con Fattura:     €    500.00           │   │
│ │ Spese Giornaliere Totali:  €  1,200.00           │   │
│ │ ECC (Non Battuto):         €  9,245.50           │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Spese Mensili Aggiuntive ────────────────────────┐   │
│ │ [+ Aggiungi Spesa] [Importa da Pagamenti]         │   │
│ │                                                    │   │
│ │ DataGrid Editabile:                               │   │
│ │ ┌────────────┬──────────┬────────┬────────────┐  │   │
│ │ │ Categoria  │ Descriz. │ Importo│ Pagamento  │  │   │
│ │ ├────────────┼──────────┼────────┼────────────┤  │   │
│ │ │ FORNITORE  │Forn. XYZ │ 500.00 │ Pag. #123  │  │   │
│ │ │ AFFITTO    │Affitto...│1200.00 │ -          │  │   │
│ │ │ UTENZE     │Elettr... │ 150.00 │ -          │  │   │
│ │ └────────────┴──────────┴────────┴────────────┘  │   │
│ │                                                    │   │
│ │ Totale Spese Aggiuntive:  € 1,850.00  [Arancione]│   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ ┌─ Riepilogo Finale ────────────────────────────────┐   │
│ │ Ricavo Totale Mese:       € 10,245.50             │   │
│ │ (-) Spese Aggiuntive:     €  1,850.00             │   │
│ │ ──────────────────────────────────────────────     │   │
│ │ RICAVO NETTO MENSILE:     €  8,395.50  [BOLD]    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ Note: ____________________________________________        │
│                                                          │
│ [Salva Bozza]  [Chiudi Mese]  [Annulla]                │
└─────────────────────────────────────────────────────────┘
```

---

## 7. IMPLEMENTAZIONE - ORDINE DI SVILUPPO

### FASE 1: Backend - Database e GraphQL
1. Creare migration database per nuove tabelle
2. Implementare resolver GraphQL per Suppliers
3. Implementare resolver GraphQL per PurchaseInvoices
4. Implementare resolver GraphQL per DeliveryNotes
5. Implementare resolver GraphQL per SupplierPayments
6. Implementare resolver GraphQL per MonthlyClosure
7. Test API con Postman/GraphQL Playground

### FASE 2: Frontend - Types e GraphQL Client
1. Creare types TypeScript in `src/@types/`
2. Creare fragments GraphQL in `src/graphql/`
3. Creare queries e mutations GraphQL
4. Creare hooks custom per operazioni

### FASE 3: Frontend - Modulo Fornitori
1. SupplierList.tsx (lista con toolbar)
2. SupplierDetails.tsx (form con validazione Zod)
3. SupplierSearchbox.tsx (ricerca fornitore)
4. Test CRUD fornitori

### FASE 4: Frontend - Modulo Acquisti
1. PurchaseInvoiceList.tsx
2. PurchaseInvoiceDetails.tsx (con griglia DDT)
3. DeliveryNoteList.tsx
4. DeliveryNoteDetails.tsx
5. SupplierPaymentList.tsx
6. SupplierPaymentDetails.tsx
7. Test flusso completo: Fattura → DDT → Pagamenti

### FASE 5: Frontend - Chiusura Mensile
1. MonthlyClosureList.tsx
2. MonthlyClosureDetails.tsx (vista principale)
3. MonthlyExpensesDataGrid.tsx (griglia spese)
4. MonthlySummaryView.tsx (riepilogo calcoli)
5. Integrazione con CashRegisterList per riepilogo mensile
6. Test chiusura completa

### FASE 6: Integrazione e Testing
1. Test end-to-end completo
2. Verificare calcoli chiusura mensile
3. Verificare integrazione con cassa giornaliera
4. Test performance con grandi volumi dati

### FASE 7: Menu e Routing
1. Aggiungere menu "Fornitori" nel database
2. Aggiungere menu "Fatture Acquisto" nel database
3. Aggiungere menu "Chiusura Mensile" nel database
4. Configurare permessi per ruoli

---

## 8. VALIDAZIONI E BUSINESS RULES

### Regole Fornitori
- `ragioneSociale` obbligatorio
- `partitaIva` o `codiceFiscale` almeno uno presente
- `partitaIva` univoco se presente

### Regole Fatture
- `numeroFattura` univoco per fornitore
- `dataFattura` non può essere nel futuro
- `imponibile` > 0
- Stato calcolato automaticamente dai pagamenti:
  - DA_PAGARE: nessun pagamento
  - PARZIALMENTE_PAGATA: pagamenti < totale
  - PAGATA: pagamenti >= totale

### Regole DDT
- `numeroDdt` univoco per fornitore
- Può esistere senza fattura
- Se collegato a fattura, fornitore deve coincidere

### Regole Pagamenti
- Deve avere `fatturaId` O `ddtId` (almeno uno)
- `dataPagamento` non può essere nel futuro
- `importo` > 0
- Non può pagare più del totale fattura/DDT

### Regole Chiusura Mensile
- Una sola chiusura per mese/anno
- Non può chiudere mese futuro
- Se stato = CHIUSA, non può più modificare spese
- `ultimoGiornoLavorativo` deve essere ultimo giorno del mese (o precedente se weekend)

---

## 9. CALCOLI CHIUSURA MENSILE

### Formula Ricavo Netto Mensile
```typescript
// 1. Riepilogo da CashRegister (somma di tutto il mese)
const ricavoTotale = sum(cashRegisters.map(cr =>
  (cr.closingTotal + cr.invoicePayments) - (cr.openingTotal + cr.supplierExpenses + cr.dailyExpenses)
));

const totaleContanti = sum(cashRegisters.map(cr => cr.cashInWhite));
const totaleElettronici = sum(cashRegisters.map(cr => cr.electronicPayments));
const totaleFatture = sum(cashRegisters.map(cr => cr.invoicePayments));

// 2. Spese aggiuntive mensili
const speseAggiuntive = sum(speseMensili.map(e => e.importo));

// 3. Ricavo netto
const ricavoNetto = ricavoTotale - speseAggiuntive;
```

---

## 10. NOTE TECNICHE

### Considerazioni Performance
- Indicizzare campi di ricerca (PartitaIva, NumeroFattura, NumeroDdt)
- Paginazione per liste fornitori/fatture
- Cache GraphQL per riepilogo mensile

### Considerazioni Sicurezza
- Solo utenti autorizzati possono chiudere mesi
- Audit log per modifiche chiusure mensili
- Backup automatico prima di chiudere

### Considerazioni UX
- Colori consistenti con CashRegisterList (verde/giallo/arancione)
- Supporto tema scuro tramite palette MUI
- Conferma prima di chiudere mese
- Validazione real-time nei form

---

## 11. MILESTONE E TEMPI STIMATI

| Fase | Descrizione | Stima |
|------|-------------|-------|
| 1 | Backend DB + GraphQL | 3-4 giorni |
| 2 | Frontend Types + GraphQL | 1 giorno |
| 3 | Modulo Fornitori | 2 giorni |
| 4 | Modulo Acquisti | 3-4 giorni |
| 5 | Chiusura Mensile | 2-3 giorni |
| 6 | Testing e Bug Fix | 2 giorni |
| 7 | Menu e Deploy | 1 giorno |

**TOTALE STIMATO: 14-18 giorni lavorativi**

---

**Fine Piano Implementazione**
