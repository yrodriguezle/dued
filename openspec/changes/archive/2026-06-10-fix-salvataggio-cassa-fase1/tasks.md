# Tasks: Fix Salvataggio Cassa — Fase 1

**Change**: fix-salvataggio-cassa-fase1
**Date**: 2026-06-09
**Status**: Ready for apply

> **Nota coerenza design↔specs** (il design è stato scritto in parallelo alle specs; verificato ora):
>
> 1. **DDT senza numero** — la spec `gestione-cassa` (req. "Riuso DocumentoTrasporto") dice che due DDT
>    senza numero "risolvono allo stesso documento normalizzato"; il design (Decision 1, confermato
>    dall'orchestratore) usa il placeholder deterministico `SN-{yyyyMMdd}-{seq}`, per cui due righe senza
>    numero nello STESSO salvataggio producono documenti distinti (seq 1, 2) riusati in modo idempotente
>    ai risalvataggi. Il placeholder soddisfa il nucleo normativo della spec (nessuna violazione UNIQUE,
>    comportamento deterministico e documentato): si adotta il placeholder e si allinea il wording dello
>    scenario nella delta spec (task 1.1).
> 2. **IVA in CashSummary** — la spec (req. "IVA visualizzata dal backend") impone `importoIva` dal server
>    con valore neutro (0) quando assente; il design (Decision 7) proponeva uno scorporo locale con
>    `vatRate` dallo store. **Risolto a favore della spec**: CashSummary usa `importoIva` dal backend,
>    nessun ricalcolo locale (task 3.5).
> 3. **Nome env var connection string** — la spec `sicurezza` cita come esempio `ConnectionStrings__Default`;
>    `Program.cs:78` legge `CONNECTION_STRING`. Nessun conflitto reale: la catena
>    `CONNECTION_STRING → Configuration.GetConnectionString("Default")` supporta entrambe (la seconda via
>    provider di configurazione .NET standard). Si documenta `CONNECTION_STRING` come variabile primaria
>    (task 2.4).
>
> Nessuna migrazione database. Nessuna modifica allo schema GraphQL (verificato: `PagamentoFornitoreType`
> e `RegistroCassaFragment` espongono già `pagamentoId`/`fatturaId`/`ddtId`/numeri documento; `importoIva`
> e `totaleVendite` già sul tipo `RegistroCassa`).

---

## Phase 1: Backend — Fix salvataggio registro cassa e totali

File principale: `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs`

- [x] 1.1 Allineare il wording dello scenario "Due righe DDT senza numero per lo stesso fornitore" in
      `openspec/changes/fix-salvataggio-cassa-fase1/specs/gestione-cassa/spec.md` al comportamento
      placeholder deciso (ogni riga senza numero risolve a un documento placeholder `SN-{yyyyMMdd}-{seq}`
      distinto e riusabile in modo idempotente), come da nota di coerenza sopra.
      *(Spec: req. "Riuso DocumentoTrasporto esistente", scenario 2)*

- [x] 1.2 Trasformare `CreaDocumentoTrasporto` (riga ~384) in lookup-or-create con firma estesa
      `(db, pagInput, dataRegistro, registroCassaId, HashSet<int> ddtConsumati)`:
      - numero valorizzato: lookup per `(FornitoreId, NumeroDdt.Trim())`; se trovato, riusare l'ID
        aggiornando `DataDdt`, `Importo`, `UpdatedAt`;
      - numero vuoto/whitespace: cercare i DDT del fornitore con prefisso `SN-{dataRegistro:yyyyMMdd}-`;
        riusare il primo "libero" (nessun pagamento di registri diversi da `registroCassaId` — sub-query su
        `db.PagamentiFornitori` se manca la navigation `Pagamenti` — e non già consumato nella richiesta);
        altrimenti creare con numero `SN-{yyyyMMdd}-{seq}` (primo progressivo libero, lunghezza ≤ 50);
      - registrare ogni `DdtId` riusato/creato in `ddtConsumati`.
      *(Spec gestione-cassa: req. "Riuso DocumentoTrasporto esistente", tutti e 3 gli scenari; design Decision 1)*

- [x] 1.3 Estendere `CreaFatturaAcquisto` (riga ~325) con firma
      `(db, pagInput, dataRegistro, registroCassaId, HashSet<int> fattureConsumate)`:
      - eseguire SEMPRE il lookup `(FornitoreId, NumeroFattura)`, rimuovendo lo skip
        `string.IsNullOrEmpty` (riga ~333); numero vuoto normalizzato con lo stesso meccanismo placeholder
        `SN-{yyyyMMdd}-{seq}` del task 1.2 (helper condiviso);
      - fattura esistente senza pagamenti o con pagamenti SOLO del registro corrente → riusarla aggiornando
        `Imponibile`/`ImportoIva`/`TotaleConIva`/`DataFattura` con lo scorporo già usato in
        `UpdatePagamentiEsistenti`;
      - fattura con almeno un pagamento di un ALTRO registro → lanciare `GraphQL.ExecutionError`
        (pattern di `backend/Services/.../DocumentoTrasportoService.cs:25`) al posto di
        `InvalidOperationException`, con numero fattura e fornitore nel messaggio; l'errore deve propagare
        il rollback della transazione esistente.
      *(Spec gestione-cassa: req. "Deduplicazione fatture estesa al numero vuoto" + req. "Distinzione tra
      riscrittura dello stesso registro e doppia registrazione"; spec sicurezza: scenario "Errore di dominio
      con messaggio per l'utente in produzione"; design Decisions 2 e 5)*

- [x] 1.4 Aggiornare il chiamante `CreaPagamentiNuovi` (chiamate alle righe ~301 e ~309): passare
      `registroCassa.Id` e due `HashSet<int>` (fatture/DDT consumati) istanziati una volta per richiesta,
      così righe multiple della stessa mutation non consumano lo stesso documento placeholder.
      *(Design Decision 1-2, "Interfaces / Contracts")*

- [x] 1.5 Correggere la formula in `CalcolaTotali` (riga 412):
      `registroCassa.ContanteAtteso = registroCassa.IncassoContanteTracciato - registroCassa.SpeseFornitori - registroCassa.SpeseGiornaliere;`
      Restano invariati: `VenditeContanti = 0` (riga 406), `TotaleVendite` (righe 407-410),
      `Differenza` (riga 417), `ContanteNetto`, scorporo `ImportoIva` (righe 421-422).
      *(Spec gestione-cassa: req. "Formula ContanteAtteso corretta", entrambi gli scenari, incluso
      ContanteAtteso negativo del req. "Salvataggio registro con saldo di giornata negativo")*

- [x] 1.6 Compilare il backend (`cd backend && dotnet build`) e correggere eventuali errori prima di
      passare alla fase 2.

## Phase 2: Backend — Hardening sicurezza

File principali: `backend/Program.cs`, `backend/appsettings.json`, `backend/.env.example`

- [x] 2.1 In `Program.cs`, `AddErrorInfoProvider` (riga ~166): sostituire `ExposeExceptionDetails = true`
      con `builder.Environment.IsDevelopment()` (idem per `ExposeData`/`ExposeExtensions` se presenti),
      rimuovendo il flag di test del commit 18d9803.
      *(Spec sicurezza: req. "Dettagli errori GraphQL esposti solo in Development", scenari 1-2)*

- [x] 2.2 In `Program.cs`, `UnhandledExceptionDelegate` (riga ~179): mantenere SEMPRE il logging server-side
      (`logger.LogError`); eseguire il blocco che riscrive `ErrorMessage` con tipo/inner exception/stack
      trace SOLO se `env.IsDevelopment()` (la variabile `env` è già risolta a riga ~173). Verificare che gli
      `ExecutionError` di business (task 1.3) arrivino al client invariati in tutti gli ambienti.
      *(Spec sicurezza: scenari "Eccezione non gestita in produzione/Development" e "Errore di dominio...")*

- [x] 2.3 In `Program.cs`: rendere i fallback dei secrets attivi solo in Development con fail-fast altrove:
      - connection string (riga 78): `CONNECTION_STRING` → `GetConnectionString("Default")` → se
        `IsDevelopment()` fallback `server=localhost;database=duedgusto;user=root;password=root`,
        altrimenti `throw new InvalidOperationException` con il nome della variabile mancante;
      - JWT key (riga 144): `JWT_SECRET_KEY` → `Jwt:Key` → se `IsDevelopment()` una NUOVA chiave dev
        dichiaratamente insicura e DIVERSA dalla chiave storica esposta, altrimenti fail-fast.
      *(Spec sicurezza: req. "Secrets fuori dal repository", scenari "Avvio locale in Development",
      "Avvio in produzione con variabili d'ambiente", "Secret mancante in produzione"; design Decision 6)*

- [x] 2.4 Rimuovere i secrets da `backend/appsettings.json` versionato: eliminare il valore di
      `ConnectionStrings:Default` (o l'intera sezione) e `Jwt:Key`; conservare `Logging`, `AllowedHosts`,
      `Jwt:Issuer`, `Jwt:Audience`. Verificare che `backend/.env` resti escluso da git (`.gitignore`) e non
      tracciato.
      *(Spec sicurezza: scenario "Repository senza secrets")*

- [x] 2.5 Correggere `backend/.env.example`: rinominare la variabile commentata `DB_CONNECTION_STRING` in
      `CONNECTION_STRING` (nome realmente letto da `Program.cs:78` — bug documentale rilevato nel design) e
      documentare le variabili richieste in produzione (`CONNECTION_STRING`, `JWT_SECRET_KEY`) più le
      opzionali (`SUPERADMIN_PASSWORD`, `SEED_ON_STARTUP`).
      *(Design Decision 6)*

- [x] 2.6 Aggiornare la sezione "appsettings.json" di `backend/CLAUDE.md`, che oggi riporta la connection
      string con password e la JWT key reali: sostituirla con la nuova struttura senza secrets e il
      riferimento alle variabili d'ambiente.

- [x] 2.7 Compilare il backend (`dotnet build`) e verificare l'avvio locale `dotnet run` in Development
      senza variabili d'ambiente impostate (fallback dev attivo, migrazioni e login funzionanti).
      *(Spec sicurezza: scenario "Avvio locale in Development senza configurazione aggiuntiva")*

## Phase 3: Frontend — Sync ID righe spese e totali dal server

File principali in `duedgusto/src/components/pages/registrazioneCassa/`

- [x] 3.1 Creare l'helper puro di matching (file colocato, es. `syncExpenseRowsWithPagamenti.tsx`):
      input = righe spesa griglia + `result.pagamentiFornitori`; output = righe aggiornate oppure segnale
      di mismatch. Due passate:
      - passata 1, chiave esatta `${fornitoreId}|${tipoDocumento}|${numeroDocumento}` (lato server:
        `p.fattura ? fattura.fornitore.fornitoreId|FA|numeroFattura : ddt.fornitore.fornitoreId|DDT|numeroDdt`);
      - passata 2, righe con numero vuoto (il server ha assegnato placeholder `SN-...`): abbinare ai
        pagamenti non ancora abbinati per `fornitoreId` + tipo, preferendo importo uguale, in ordine;
      - per ogni match aggiornare `pagamentoId`, `fatturaId`, `ddtId` E `invoiceNumber`/`ddtNumber` con il
        valore del server (placeholder incluso, per stabilità della chiave ai salvataggi successivi);
      - pagamenti non abbinabili o righe rimaste senza ID → mismatch.
      Usare le utility di `src/common/bones/` (no lodash) e iterazione funzionale.
      *(Spec gestione-cassa: req. "Sincronizzazione ID documenti", scenari "Aggiornamento righe miste" e
      "Mismatch"; design Decision 3)*

- [x] 3.2 Integrare l'helper in `RegistroCassaDetails.tsx` → `onSubmit` (righe ~354-445): dopo mutation
      riuscita applicare le righe aggiornate alla griglia spese via
      `expensesGridRef.current.api.applyTransaction({ update })` (pattern skill datagrid), senza toccare
      `initialExpenses` né lo stato dirty; in caso di mismatch NON applicare aggiornamenti parziali,
      loggare con `logger.warn` e affidarsi al `refetchQueries` su `getRegistroCassa` già presente in
      `useSubmitCashRegister`.
      *(Spec gestione-cassa: scenari "Risalvataggio immediato prima del refetch" e "Mismatch")*

- [x] 3.3 Propagare i dati server al riepilogo: `RegistroCassaDetails.tsx` passa il registro
      (`useQueryCashRegister`) come prop `registroCassa?: RegistroCassa | null` a
      `CashRegisterFormDataGrid.tsx`, che la inoltra a `SummaryDataGrid` (riga ~111).
      *(Design Decision 7, "Interfaces / Contracts")*

- [x] 3.4 `SummaryDataGrid.tsx` (righe ~73-74): il KPI "Totale Vendite" usa `registroCassa?.totaleVendite`
      quando disponibile; il fallback locale per registro non ancora salvato passa da
      `movement + electronic + invoice` a `cash + electronic + invoice` (formula backend). Gli altri KPI
      live restano calcolati dalle griglie.
      *(Spec gestione-cassa: req. "Totale Vendite frontend allineato al backend", scenario unico)*

- [x] 3.5 `CashSummary.tsx` (riga ~59): sostituire `const vatAmount = totalSales * 0.1` con il valore
      `importoIva` del backend (prop/dato dal registro server) e valore neutro `0` quando il dato server
      non è ancora disponibile — NESSUN ricalcolo locale (risolto a favore della spec rispetto al design
      che proponeva scorporo con `vatRate`; vedi nota di coerenza). Aggiungere commento che il componente è
      dead code candidato a rimozione in Fase 4.
      *(Spec gestione-cassa: req. "IVA visualizzata dal backend", entrambi gli scenari)*

- [x] 3.6 Aggiornare `__tests__/SummaryDataGrid.test.tsx`: caso con prop `registroCassa` valorizzata
      (Totale Vendite = `totaleVendite` server, es. 500 con contante 300 + elettronico 150 + fattura 50 e
      movimento fisico 280 che NON altera il KPI) e caso fallback senza prop (formula
      `cash + electronic + invoice`).
      *(Spec gestione-cassa: scenario "Totale Vendite coerente tra riepilogo e backend")*

- [x] 3.7 Scrivere il test unitario Vitest colocato per l'helper del task 3.1: match per chiave esatta,
      match seconda passata per righe senza numero (con riscrittura del placeholder), righe miste FA/DDT
      che non si scambiano gli ID, mismatch → segnale senza aggiornamenti parziali.
      *(Spec gestione-cassa: scenari del req. "Sincronizzazione ID documenti"; design Testing Strategy)*

## Phase 4: Verifica

- [x] 4.1 Verifica statica completa: `cd backend && dotnet build`; `cd duedgusto && npm run ts:check`;
      `cd duedgusto && npm run lint` — tutto verde.
      *(Proposal Success Criteria; regola verify di openspec/config.yaml)*

- [x] 4.2 Test unitari frontend: `cd duedgusto && npm run test` — inclusi i test dei task 3.6 e 3.7.

- [x] 4.3 Scenario manuale A — saldo negativo con documenti: registro con incasso contante tracciato 100€,
      righe spesa per 250€ con una fattura e un DDT → il salvataggio completa; su MySQL `ContanteAtteso`
      negativo col segno corretto, fattura e DDT creati una sola volta.
      *(Spec gestione-cassa: req. "Salvataggio registro con saldo negativo", scenario 1)*

- [x] 4.4 Scenario manuale B — risalvataggio immediato senza refetch: premere di nuovo Salva subito dopo il
      salvataggio A → nessun `Duplicate entry`, nessun pagamento/fattura/DDT duplicato su MySQL; verificare
      in rete/log che le righe siano partite con `pagamentoId` valorizzato (ramo UPDATE).
      *(Spec gestione-cassa: scenari "Risalvataggio consecutivo" e "Risalvataggio immediato prima del refetch")*

- [x] 4.5 Scenario manuale C — numeri vuoti: due righe DDT senza numero per lo stesso fornitore → salvataggio
      OK, su MySQL due DDT con placeholder `SN-{yyyyMMdd}-1` e `SN-{yyyyMMdd}-2`; risalvare → stessi due
      record, nessun nuovo placeholder. Ripetere con una fattura senza numero (dedup al risalvataggio).
      *(Spec gestione-cassa: scenari "Due righe DDT senza numero", "Fattura con numero vuoto già esistente")*

- [x] 4.6 Scenario manuale D — vera doppia registrazione: salvare il registro R2 (giorno diverso) con la
      stessa fattura già pagata dal registro R1 → errore esplicito con numero fattura e fornitore, R2 non
      salvato nemmeno parzialmente (rollback completo).
      *(Spec gestione-cassa: scenario "Vera doppia registrazione"; spec sicurezza: messaggio leggibile)*

- [x] 4.7 Verifica formula: registro con contante tracciato 500€, spese fornitori 120€, giornaliere 30€,
      apertura 200€, chiusura 550€ → `ContanteAtteso` 350€, `Differenza` 0€; registro con 50€ di incassi e
      200€ di spese → `ContanteAtteso` −150€. Confrontare i valori persistiti su MySQL.
      *(Spec gestione-cassa: scenari del req. "Formula ContanteAtteso corretta")*

- [x] 4.8 Verifica sicurezza errori: avviare con `ASPNETCORE_ENVIRONMENT=Production` (env var impostate) e
      provocare un'eccezione non gestita → risposta GraphQL generica senza tipo/stack trace, dettagli nei
      log; in Development i dettagli restano nella risposta; il messaggio di doppia registrazione (4.6)
      arriva al client anche in Production.
      *(Spec sicurezza: tutti gli scenari del req. "Dettagli errori GraphQL")*

- [x] 4.9 Verifica secrets: avvio con `ASPNETCORE_ENVIRONMENT=Production` SENZA `CONNECTION_STRING` /
      `JWT_SECRET_KEY` → fail-fast con messaggio che indica la variabile mancante; CON le variabili →
      avvio regolare con i valori delle env var; `git ls-files` conferma che `appsettings.json` non
      contiene secrets e che `.env` non è tracciato.
      *(Spec sicurezza: scenari "Secret mancante in produzione", "Avvio in produzione", "Repository senza secrets")*

- [x] 4.10 Controllo regressione collaterale: verificare che `VistaMensile.tsx` (riga ~78, replica le
      formule di `SummaryDataGrid`) non diverga visivamente dopo l'allineamento del task 3.4; se diverge,
      segnalarlo come finding per la Fase successiva (NON correggerlo in questa change).
      *(Design Decision 7, nota fuori scope)*
