# Tasks: Ciclo DDT → Fattura Acquisto

## Phase 1: Backend — Query e Orchestrator

- [ ] 1.1 Aggiungere query `documentiTrasportoAperti(fornitoreId)` in `backend/GraphQL/Fornitori/FornitoriQueries.cs` — filtra `DocumentiTrasporto` per `FornitoreId == fornitoreId && FatturaId == null`, ordinati per `DataDdt` decrescente, usa `AppDbContext` direttamente (pattern esistente)

- [ ] 1.2 Aggiungere metodo privato `RicalcolaTotaliFatturaAsync` in `backend/GraphQL/Fornitori/FatturaAcquistoOrchestrator.cs` — carica tutti i DDT associati alla fattura, somma `Importo ?? 0`, calcola `TotaleConIva`, `Imponibile` e `ImportoIva` usando l'aliquota corrente (derivata dal rapporto `ImportoIva/Imponibile`, fallback 22%)

- [ ] 1.3 Aggiungere metodo `AssociaDdtAsync(int fatturaId, List<int> ddtIds)` in `FatturaAcquistoOrchestrator.cs` — in transazione: carica fattura e DDT, valida che tutti i DDT abbiano `FatturaId == null` e stesso `FornitoreId` della fattura, setta `FatturaId`, chiama `RicalcolaTotaliFatturaAsync`, restituisce fattura

- [ ] 1.4 Aggiungere metodo `DisassociaDdtAsync(int fatturaId, List<int> ddtIds)` in `FatturaAcquistoOrchestrator.cs` — in transazione: carica DDT, valida che abbiano `FatturaId == fatturaId`, setta `FatturaId = null`, chiama `RicalcolaTotaliFatturaAsync`, restituisce fattura

## Phase 2: Backend — Mutation GraphQL

- [ ] 2.1 Aggiungere mutation `associaDdtAFattura(fatturaId, ddtIds)` in `backend/GraphQL/Fornitori/FornitoriMutations.cs` — argomenti `NonNullGraphType<IntGraphType>` e `NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>`, chiama `orchestrator.AssociaDdtAsync`, restituisce `FatturaAcquistoType`

- [ ] 2.2 Aggiungere mutation `disassociaDdtDaFattura(fatturaId, ddtIds)` in `FornitoriMutations.cs` — stessa struttura di 2.1, chiama `orchestrator.DisassociaDdtAsync`

- [ ] 2.3 Verificare che il backend compili: `cd backend && dotnet build`

## Phase 3: Frontend — Query e Mutation GraphQL

- [ ] 3.1 Aggiungere query `getDocumentiTrasportoAperti` in `duedgusto/src/graphql/fornitori/queries.tsx` — interfacce `GetDocumentiTrasportoApertiData` e `GetDocumentiTrasportoApertiVariables`, usa fragment leggero (solo `ddtId`, `numeroDdt`, `dataDdt`, `importo`, `note`)

- [ ] 3.2 Aggiungere mutation `mutationAssociaDdtAFattura` in `duedgusto/src/graphql/fornitori/mutations.tsx` — interfacce `AssociaDdtAFatturaData/Variables`, restituisce `FatturaAcquistoFragment`

- [ ] 3.3 Aggiungere mutation `mutationDisassociaDdtDaFattura` in `duedgusto/src/graphql/fornitori/mutations.tsx` — interfacce `DisassociaDdtDaFatturaData/Variables`, restituisce `FatturaAcquistoFragment`

## Phase 4: Frontend — Dialog Prelievo DDT

- [ ] 4.1 Creare `duedgusto/src/components/pages/fattureAcquisto/PrelevaDdtDialog.tsx` — Dialog MUI con griglia AG Grid, props: `open`, `fornitoreId`, `onConfirm(ddtIds)`, `onClose`. Colonne: Numero DDT, Data DDT, Importo (formattato 2 decimali), Note. Selezione multipla con `rowSelection: "multiple"` e checkbox. Totale selezionato calcolato in tempo reale. Bottone "Conferma" disabilitato se nessuna selezione. Messaggio "Nessun DDT aperto disponibile" se lista vuota.

## Phase 5: Frontend — Integrazione Toolbar e Griglia

- [ ] 5.1 Aggiungere bottone "Preleva DDT" in `duedgusto/src/components/pages/fattureAcquisto/FatturaAcquistoDetails.tsx` — usare `FormikToolbarButton` dentro la prop `children` di `FormikToolbar`. Visibile solo quando: `formStatus === UPDATE && !isFormLocked && fornitoreId > 0`. Icona: `LocalShippingIcon`. Al click apre `PrelevaDdtDialog` (gestire stato `open` con `useState`).

- [ ] 5.2 Aggiungere handler `handleAssociaDdt` in `FatturaAcquistoDetails.tsx` — chiama `mutationAssociaDdtAFattura` con `fatturaId` e `ddtIds` ricevuti dal dialog, mostra toast successo, chiama `loadInvoiceData` per ricaricare la fattura, chiude il dialog. In caso di errore mostra toast errore e lascia il dialog aperto.

- [ ] 5.3 Aggiungere colonna azione "Rimuovi" nella griglia DDT in `duedgusto/src/components/pages/fattureAcquisto/FatturaAcquistoForm.tsx` — aggiungere colonna con `cellRenderer` che mostra icona `LinkOffIcon` o `RemoveCircleOutlineIcon`. Al click chiama callback `onDisassociaDdt(ddtId)` passata come prop.

- [ ] 5.4 Aggiungere handler `handleDisassociaDdt` in `FatturaAcquistoDetails.tsx` — chiede conferma con `useConfirm` ("Vuoi disassociare il DDT dalla fattura?"), chiama `mutationDisassociaDdtDaFattura`, mostra toast, ricarica fattura. Passa la callback a `FatturaAcquistoForm` come nuova prop `onDisassociaDdt`.

## Phase 6: Verifica

- [ ] 6.1 Verificare compilazione TypeScript: `cd duedgusto && npm run ts:check`
- [ ] 6.2 Verificare lint: `cd duedgusto && npm run lint`
- [ ] 6.3 Verificare compilazione backend: `cd backend && dotnet build`
