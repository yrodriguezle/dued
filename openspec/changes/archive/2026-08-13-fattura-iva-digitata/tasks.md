# Tasks: IVA digitata sulle fatture acquisto

**Change**: fattura-iva-digitata
**Riferimenti**: `proposal.md`, `design.md`, `specs/calcoli-iva/spec.md`

Convenzioni vincolanti: nessuna formula IVA inline nuova (tutto via `IvaCalculator`); la modalità si
decide dove arriva l'input (`ImportoIva is null`) e si legge solo nel ricalcolo da DDT; gli input
GraphQL non portano flag di modalità separati.

> **Nota di percorso.** Le fasi 1–3 sono state realizzate una prima volta con la modalità *dedotta*
> dagli importi, senza colonna. La decisione è stata ribaltata dopo aver constatato il falso negativo
> (`22,00` su `100,00` indistinguibile) e la fase 4 ha sostituito la deduzione con il campo
> persistito, rimuovendo le funzioni diventate morte. I task sotto riflettono lo stato finale.

---

## Phase 1: Backend — operazioni a IVA nota

- [x] 1.1 `backend/Common/IvaCalculator.cs`: aggiungi `DaImportoEsplicito(imponibile, iva)` e
  `RipartisciConIvaNota(lordo, iva)`, duali di `ApplicaSuImponibile`/`ScorporaDaLordo` con l'IVA
  come input; stesso `MidpointRounding`, nessuna guard su segno o su `iva > lordo`.
  [Req: "Operazioni IVA con l'IVA come dato"]
- [x] 1.2 `backend/Common/IvaCalculator.cs`: aggiungi `AliquotaImplicitaPercentuale(imponibile, iva)`
  con doc esplicita che è un valore da mostrare, non su cui decidere.
  [Req: "Aliquota implicita come valore di sola presentazione"]
- [x] 1.3 `backend/DuedGusto.Tests/Unit/Common/IvaCalculatorTests.cs`: nuova region con Theory su
  entrambe le operazioni (casi esatti, IVA zero, storni, `iva > lordo`) e su `AliquotaImplicitaPercentuale`
  inclusi i casi non derivabili. [Testing Strategy — Unit]

## Phase 2: Backend — modalità persistita e canale di input

- [x] 2.1 `backend/Models/FatturaAcquisto.cs`: proprietà `IvaCalcolata` bool `[Required]` default
  `true`, con XML doc che spiega perché gli importi da soli non basterebbero.
  [Req: "Modalità IVA persistita sulla fattura acquisto"]
- [x] 2.2 `backend/DataAccess/AppDbContext.cs`: `entity.Property(x => x.IvaCalcolata).IsRequired().HasDefaultValue(true)`
  nella configurazione di `FatturaAcquisto`. [Req: idem]
- [x] 2.3 Migrazione `dotnet ef migrations add AddIvaCalcolataToFatturaAcquisto`: verifica che il DDL
  sia `AddColumn<bool> tinyint(1) NOT NULL defaultValue: true` e che `Down()` droppi la colonna.
  Nessun backfill SQL: il default è semanticamente esatto per lo storico.
  [Req: idem — scenario "Backfill dello storico"; Design: Migration/Rollout]
- [x] 2.4 `backend/GraphQL/Fornitori/Types/FatturaAcquistoInputType.cs`: `ImportoIva` decimal opzionale
  con doc "prevale su AliquotaIva"; field GraphQL nullable.
  [Req: "Importo IVA esplicito negli input"]
- [x] 2.5 `backend/GraphQL/GestioneCassa/Types/RegistroCassaInputType.cs`: idem su
  `PagamentoFornitoreRegistroInput`, valido solo per `TipoDocumento = "FA"`. [Req: idem]
- [x] 2.6 `backend/GraphQL/Fornitori/Types/FatturaAcquistoType.cs`: field `ivaCalcolata`. [Req: idem]

## Phase 3: Backend — i quattro punti che riscrivono gli importi

- [x] 3.1 `FatturaAcquistoOrchestrator.MutateAsync`: se `input.ImportoIva` è valorizzato usa
  `DaImportoEsplicito`, altrimenti `ApplicaSuImponibile`; imposta `fattura.IvaCalcolata = input.ImportoIva is null`.
  [Req: "Modalità IVA persistita" — scenari fattura digitata / da aliquota / ritorno alla modalità aliquota]
- [x] 3.2 `DocumentiFornitoreService`: aggiungi `ImportoIva` a `DatiDocumento` (parametro opzionale in
  coda, unico call site aggiornato); estrai `RipartisciImportoFatturaAsync` che sceglie fra
  `RipartisciConIvaNota` e `ScorporaDaLordo`; imposta `IvaCalcolata` sia in creazione sia in riuso.
  [Req: "Importo IVA esplicito negli input" — scenari pagamento fornitore]
- [x] 3.3 `MutateRegistroCassaOrchestrator`: passa `pagInput.ImportoIva` in `DatiDocumento`; estrai
  `RipartisciImportoPagamentoAsync` con la stessa regola e imposta `linkedFattura.IvaCalcolata`
  nell'update dei pagamenti esistenti. [Req: idem]
- [x] 3.4 `FatturaAcquistoOrchestrator.RicalcolaTotaliFatturaAsync`: ramo `!IvaCalcolata && ImportoIva is decimal`
  → `RipartisciConIvaNota(totale, iva)`; altrimenti scorporo dall'aliquota ricavata inversamente,
  invariato. [Req MODIFIED: "Sostituzione delle formule IVA inline" — tutti gli scenari]
- [x] 3.5 `AssociaDdtAsync`/`DisassociaDdtAsync`: `await _unitOfWork.SaveChangesAsync()` dopo l'assegnazione
  di `FatturaId` e PRIMA di `RicalcolaTotaliFatturaAsync` — `Repository.FindAsync` è
  `Where(...).ToListAsync()`, quindi legge il database e non il change tracker.
  [Req: "Persistenza dell'associazione DDT prima del ricalcolo"; bug preesistente emerso dal test 3.7]
- [x] 3.6 `IvaBreakdownCreditoCalculator`: riusa `AliquotaImplicitaPercentuale`; `AliquotaMista`
  diventa `!fattura.IvaCalcolata || !IsAliquotaAmmessa(percent)`.
  [Req MODIFIED: "Etichettatura dell'aliquota mista"]
- [x] 3.7 Nuovo `backend/DuedGusto.Tests/Integration/GraphQL/FatturaIvaDigitataTests.cs` su
  `AppDbContext` InMemory + `UnitOfWork` reale: inserimento nelle due modalità, ritorno alla modalità
  aliquota, prelievo e rimozione DDT su fattura congelata, **IVA digitata pari al 22 % congelata
  comunque**, prelievo su monoaliquota invariato (244 → 200/44), creazione da cassa nelle due modalità.
  [Testing Strategy — Integration]
- [x] 3.8 `IvaBreakdownCreditoCalculatorTests`: helper esteso con `ivaCalcolata`; nuovo caso IVA
  digitata al 22 % → `AliquotaMista = true`. [Testing Strategy — Unit]
- [x] 3.9 Rimozione della deduzione: cancellata `IvaCalculator.IvaNonRiconducibileAdAliquota` e i suoi
  test, diventati codice morto con un commento che documentava un limite non più vero.
  [Design: decisione modalità persistita]
- [x] 3.10 Gate di fase: `dotnet build` e `dotnet test` verdi. — build 0 warning/0 errori, 695/695 test.

## Phase 4: Frontend — spunta, campo IVA, ripristino

- [x] 4.1 Nuovo `duedgusto/src/common/iva/aliquote.tsx`: `arrotondaCentesimi`, `aliquotaImplicita`,
  `defaultAliquotaIva`. Solo presentazione: la modalità arriva da `ivaCalcolata`.
  [Design: decisione frontend]
- [x] 4.2 `duedgusto/src/common/iva/__tests__/aliquote.test.tsx`: stessi casi del calculator backend,
  per tenere allineate le due copie. [Testing Strategy — Frontend]
- [x] 4.3 `FatturaAcquistoDetails.tsx`: schema Zod con `vatFromRate` e `vatAmount` + `superRefine`
  (`vatAmount ≤ totalAmount` a spunta OFF); `mapFatturaToFormValues` legge `invoice.ivaCalcolata`;
  `mapFormValuesToInput` invia `importoIva` solo a spunta OFF.
  [Req: "Importo IVA esplicito negli input"]
- [x] 4.4 `useInitializeValues.tsx`: default `vatFromRate: true`, `vatAmount: 0`.
- [x] 4.5 `FatturaAcquistoForm.tsx`: `FormikCheckbox` «Calcola IVA dall'aliquota»; a spunta OFF il
  campo IVA diventa editabile e l'aliquota diventa `NumberField` disabilitato etichettato "(media)";
  al cambio spunta riallinea il campo che sta per diventare editabile, così gli importi non saltano.
- [x] 4.6 `PagamentoFornitoreDialog.tsx`: stessa spunta per `TipoDocumento = "FA"`; guard
  `importoIva > amount` con toast; `importoIva` emesso nella riga spesa solo a spunta OFF.
  [Req: "Importo IVA esplicito negli input" — scenari pagamento]
- [x] 4.7 `RegistroCassaDetails.tsx`: ripristino della riga da `p.fattura.ivaCalcolata === false`
  invece che dall'aliquota del fornitore.
- [x] 4.8 Tipi e fragment: `importoIva`/`ivaCalcolata` in `@types/FatturaAcquisto.d.ts`,
  `@types/RegistroCassa.d.ts`, `graphql/fornitori/fragments.tsx`, `graphql/registroCassa/fragments.tsx`,
  `graphql/registroCassa/mutations.tsx`.
- [x] 4.9 Rimozione della deduzione lato frontend: cancellati `ivaNonRiconducibileAdAliquota` e
  `aliquoteAmmesse`, e i due call site che li usavano. [Design: decisione modalità persistita]
- [x] 4.10 Gate di fase: `npm run ts:check`, `npm run lint`, `npm run test` verdi. — 781/781 test in
  98 file.

## Phase 5: Verifica

- [x] 5.1 Suite backend completa sull'albero finale: 695/695 verdi, build senza warning.
- [x] 5.2 Suite frontend completa sull'albero finale: `ts:check` e `lint` puliti, 781/781 verdi.
- [x] 5.3 DDL della migrazione riscontrato a mano: colonna singola `tinyint(1) NOT NULL DEFAULT 1`,
  nessuna istruzione sui dati esistenti, `Down()` simmetrico.
- [x] 5.4 Riscontro Success Criteria della proposal: vedi `verify-report.md`.
