# Proposal: Fix Salvataggio Cassa — Fase 1

## Intent

Gli utenti segnalano: "quando aggiungo fatture o DDT in gestione cassa e il risultato (incassi - spese) è negativo, errore e la cassa non si salva". L'esplorazione ha dimostrato che il valore negativo NON è la causa (i negativi sono accettati in tutta la pipeline: modello, EF Core, MySQL `decimal(10,2)` con segno, GraphQL, Zod). La causa reale è la **duplicazione di documenti** (DDT e fatture acquisto) durante la riscrittura del registro cassa, che viola gli indici UNIQUE sul database, provoca una `DbUpdateException` e fa il rollback dell'intera transazione: la cassa non viene salvata.

Questa change (Fase 1 dell'audit di progetto) corregge i bug di salvataggio e include quattro interventi correlati di affidabilità e sicurezza richiesti dall'utente: formula `ContanteAtteso` errata, esposizione dei dettagli errori GraphQL in produzione, secrets hardcoded in `appsettings.json` versionato, e calcoli frontend divergenti dal backend.

## Scope

### In Scope

**A. Bug salvataggio registro cassa (causa radice)**
1. **Riuso DDT esistente**: `CreaDocumentoTrasporto` (`backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs`, righe ~384-400) crea sempre un nuovo `DocumentoTrasporto` senza cercarne uno esistente per `(FornitoreId, NumeroDdt)`, violando l'indice UNIQUE `IX_DocumentiTrasporto_FornitoreId_NumeroDdt`. Replicare il pattern di dedup di `CreaFatturaAcquisto`, gestendo anche il caso `NumeroDdt` vuoto (due DDT senza numero dello stesso fornitore collidono).
2. **Dedup fatture estesa**: `CreaFatturaAcquisto` (stesso file, righe ~325-354) salta la dedup se `NumeroFattura` è vuoto (`IsNullOrEmpty` a riga ~333) → `Duplicate entry` su `IX_FattureAcquisto_FornitoreId_NumeroFattura`. Estendere la dedup anche al numero vuoto; inoltre il blocco a riga ~346 lancia errore anche quando i pagamenti esistenti appartengono allo **stesso registro** in fase di riscrittura (caso legittimo): riusare la fattura in quel caso, bloccare solo la vera doppia registrazione (pagamenti di un altro registro).
3. **Sync ID lato frontend**: `RegistroCassaDetails.onSubmit` (`duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx`, righe ~354-445) non aggiorna le righe spese con `pagamentoId`/`fatturaId`/`ddtId` restituiti dal backend. Al risalvataggio prima del refetch i pagamenti vengono reinviati come nuovi (`pagamentoId=null`), `DeletePagamenti` (righe ~217-232) cancella i pagamenti ma non i documenti, e la ricreazione del DDT collide con l'UNIQUE. Dopo submit riuscito aggiornare le righe griglia spese con gli ID restituiti dalla mutation (`result.pagamentiFornitori`).

**B. Formula ContanteAtteso**
4. In `MutateRegistroCassaOrchestrator.cs` (righe ~412-417) `VenditeContanti` viene forzato a 0 prima del calcolo → `ContanteAtteso = -spese`, sempre errato, e la `Differenza` ne eredita l'errore. Formula corretta: `ContanteAtteso = IncassoContanteTracciato - SpeseFornitori - SpeseGiornaliere`.

**C. Hardening sicurezza**
5. **Dettagli errori GraphQL**: rimuovere il flag di test del commit `18d9803` (`backend/Program.cs`, `ExposeExceptionDetails = true` a riga ~166 e `unhandledExceptionDelegate` con stack trace): dettagli esposti solo in Development, messaggio generico in produzione.
6. **Secrets fuori dal repository**: connection string MySQL (`root/root`) e JWT key sono hardcoded in `backend/appsettings.json` versionato. Spostare la lettura su variabili d'ambiente con fallback di sviluppo che NON rompa `dotnet run` locale (es. `appsettings.Development.json` non versionato oppure fallback attivo solo in ambiente Development).

**D. Coerenza calcoli frontend (backend = unica fonte di verità)**
7. `CashSummary.tsx` (riga ~59) calcola l'IVA con `0.1` hardcoded → usare `importoIva` dal backend.
8. `SummaryDataGrid.tsx` (righe ~73-74) calcola il Totale Vendite con una formula diversa dal backend (movimento fisico invece dei canali di incasso) → allineare/usare i valori del server.

### Out of Scope (deferred — in attesa di decisione esplicita dell'utente)
- Guard che bloccano operazioni su `RegistroCassa` in stato CLOSED o mese chiuso (vendite, `MutateRegistroCassa`, `RegistroCassaSyncService`) e disabilitazione del save frontend su stato CLOSED.
- Modello IVA multialiquota (Fase 3 dell'audit).
- Refactoring di qualità (Fase 4 dell'audit).
- Rotazione effettiva dei secrets già esposti nella history git (da pianificare separatamente: cambio password DB e rigenerazione JWT key).

## Approach

1. **Backend — dedup documenti (cuore del fix)**: in `MutateRegistroCassaOrchestrator`, prima di creare un `DocumentoTrasporto` cercare un record esistente per `(FornitoreId, NumeroDdt)` (normalizzando il numero vuoto) e riusarne l'ID, replicando il pattern già presente in `CreaFatturaAcquisto`. In `CreaFatturaAcquisto`, eseguire la dedup anche con `NumeroFattura` vuoto e, quando la fattura esistente ha pagamenti, distinguere: pagamenti dello stesso registro in riscrittura → riuso; pagamenti di un altro registro → errore esplicito di doppia registrazione. Tutto resta dentro la transazione esistente.

2. **Backend — formula**: correggere il calcolo di `ContanteAtteso` rimuovendo l'azzeramento di `VenditeContanti` e applicando `IncassoContanteTracciato - SpeseFornitori - SpeseGiornaliere`; `Differenza` resta derivata da `ContanteAtteso`.

3. **Backend — sicurezza**: in `Program.cs` condizionare `ExposeExceptionDetails` e il delegate di eccezione all'ambiente Development. Leggere connection string e JWT key da variabili d'ambiente (convenzione .NET: `ConnectionStrings__Default`, ecc.) con fallback ai valori di sviluppo solo in Development, così `dotnet run` locale continua a funzionare senza configurazione aggiuntiva.

4. **Frontend — sync ID**: in `RegistroCassaDetails.onSubmit`, dopo mutation riuscita, mappare `result.pagamentiFornitori` sulle righe spese della griglia aggiornando `pagamentoId`, `fatturaId`, `ddtId`, così un risalvataggio immediato invia update invece di insert.

5. **Frontend — totali dal server**: sostituire i calcoli locali divergenti (`CashSummary.tsx` IVA 0.1, `SummaryDataGrid.tsx` Totale Vendite) con i valori restituiti dal backend.

**Nessuna migrazione database richiesta**: gli indici UNIQUE esistenti sono corretti e restano invariati; cambia solo la logica applicativa per rispettarli.

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modified | Dedup/riuso DDT, dedup fatture estesa (numero vuoto + riscrittura stesso registro), formula `ContanteAtteso` |
| `backend/Program.cs` | Modified | `ExposeExceptionDetails` e delegate eccezioni solo in Development |
| `backend/appsettings.json` | Modified | Rimozione secrets (connection string, JWT key) dal file versionato |
| `backend/appsettings.Development.json` (o equivalente) | New (non versionato) | Valori di sviluppo locali; aggiornare `.gitignore` |
| `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | Modified | Aggiornamento righe spese con ID restituiti dalla mutation dopo il submit |
| `duedgusto/src/components/pages/registrazioneCassa/CashSummary.tsx` | Modified | IVA da `importoIva` backend invece di 0.1 hardcoded |
| `duedgusto/src/components/pages/registrazioneCassa/SummaryDataGrid.tsx` | Modified | Totale Vendite dai valori del server |

Moduli coinvolti: **backend e frontend**. Migrazioni DB: **nessuna**.

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Il riuso di un DDT/fattura esistente aggancia un documento di un altro contesto (omonimia numero per lo stesso fornitore) | Bassa | La chiave di riuso è esattamente quella dell'indice UNIQUE `(FornitoreId, Numero)`: se il DB li considera lo stesso documento, il riuso è semanticamente corretto; il blocco resta per pagamenti di altri registri |
| Regressione sui registri già salvati con `ContanteAtteso` errato | Media | La formula corretta si applica al prossimo salvataggio/riscrittura; nessun ricalcolo retroattivo automatico (eventuale script una tantum fuori scope) |
| Lo spostamento dei secrets rompe l'avvio in produzione/deploy | Media | Fallback di sviluppo solo in Development; documentare le variabili d'ambiente richieste; verificare `dotnet run` locale e pipeline di deploy prima del merge |
| Il sync degli ID frontend desincronizza la griglia se la mutation ritorna un numero di pagamenti diverso dalle righe inviate | Bassa | Mappare per chiave (fornitore + numero documento + tipo) e non per indice; in caso di mismatch fare refetch completo |
| La rimozione dei dettagli errore in produzione complica il debug | Bassa | I dettagli restano nei log server; solo la risposta GraphQL al client diventa generica |
| Secrets già presenti nella history git restano esposti | Alta (esistente) | Fuori scope qui: la rotazione delle credenziali è documentata come follow-up obbligatorio |

## Rollback Plan

- **Backend (dedup, formula, Program.cs)**: revert dei commit; nessuna migrazione DB coinvolta, quindi il rollback è puramente applicativo. I documenti riusati restano validi anche con il codice precedente.
- **Secrets**: ripristinare temporaneamente la lettura da `appsettings.json` (i valori sono ancora nella history); le variabili d'ambiente in più non danneggiano il vecchio codice.
- **Frontend**: revert dei commit sui tre componenti; il comportamento torna a quello attuale (calcoli locali e righe senza ID), senza perdita di dati.
- **Dati**: nessuna modifica distruttiva ai dati; gli eventuali documenti duplicati pre-esistenti non vengono toccati da questa change.

## Dependencies

- Gli indici UNIQUE `IX_DocumentiTrasporto_FornitoreId_NumeroDdt` e `IX_FattureAcquisto_FornitoreId_NumeroFattura` esistono già (`Migrations/20260307142133_InitialCreate.cs`, righe ~697-701) e non cambiano.
- La mutation di salvataggio registro deve già restituire `pagamentiFornitori` con `pagamentoId`/`fatturaId`/`ddtId` (verificato dall'explore); se qualche campo manca nello schema GraphQL, va esposto in questa change.
- Il backend deve già esporre `importoIva` e i totali vendite necessari al frontend (punto D).
- Pipeline/ambiente di produzione: capacità di impostare variabili d'ambiente per connection string e JWT key.

## Success Criteria

- [ ] Salvare un registro cassa con spese > incassi (risultato negativo) e DDT/fatture allegati va a buon fine senza errori
- [ ] Risalvare lo stesso registro più volte di seguito (anche prima del refetch) non genera `Duplicate entry` né crea documenti duplicati
- [ ] Due righe spesa con DDT senza numero per lo stesso fornitore non causano errore di salvataggio
- [ ] Una fattura con numero vuoto viene deduplicata come quelle con numero valorizzato
- [ ] La vera doppia registrazione (stessa fattura con pagamenti di un altro registro) viene ancora bloccata con errore chiaro
- [ ] `ContanteAtteso = IncassoContanteTracciato - SpeseFornitori - SpeseGiornaliere` e `Differenza` coerente
- [ ] In produzione gli errori GraphQL mostrano un messaggio generico senza stack trace; in Development i dettagli restano visibili
- [ ] `backend/appsettings.json` versionato non contiene più password DB né JWT key; `dotnet run` locale funziona senza configurazione aggiuntiva
- [ ] `CashSummary` mostra l'IVA del backend e `SummaryDataGrid` il Totale Vendite del backend (nessun calcolo locale divergente)
- [ ] `dotnet build` (backend) e `npm run ts:check` + `npm run lint` (frontend) passano
