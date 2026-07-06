# Tasks: Spese sul registro giornaliero (chiusura mensile = pura aggregazione)

**Change**: spese-su-registro-giornaliero
**Riferimento**: GitHub issue #8
**Artefatti**: `proposal.md`, `design.md`, `specs/chiusure-mensili/spec.md`, `specs/gestione-cassa/spec.md`

> Convenzioni: task piccoli (una sessione ciascuno), ordinati per dipendenza. I task di
> migrazione DB (Fase 2) sono separati dai task di codice modello (Fase 1) e vanno eseguiti
> nell'ordine **add-colonne prima, drop-tabelle poi**. Regola CI: `dotnet build`/`dotnet test`
> per backend, `ts:check`/`lint`/`test` per frontend.

---

## Phase 1: Backend — Modello EF Core & configurazione DbContext (foundation, no migrazioni)

- [x] 1.1 In `backend/Models/SpesaCassa.cs` aggiungere `public CategoriaSpesa Categoria { get; set; } = CategoriaSpesa.Altro;` (NOT NULL, default `Altro`, Decision 1). Verificare che l'enum `CategoriaSpesa` (`Affitto | Utenze | Stipendi | Altro`) sia accessibile/importato.
- [x] 1.2 In `backend/Models/PagamentoFornitore.cs` aggiungere `public CategoriaSpesa? Categoria { get; set; }` (nullable, default NULL, Decision 2) e **rimuovere** la navigation `ICollection<SpesaMensile> SpeseMensili`.
- [x] 1.3 In `backend/Models/ChiusuraMensile.cs` rimuovere le navigation `SpeseLibere` e `PagamentiInclusi` (mantenere `RegistriInclusi`).
- [x] 1.4 In `backend/Models/ChiusuraMensile.cs` rimuovere i 4 `[NotMapped]` PR #7: `SpeseAggiuntiveCalcolate`, `SpeseAggiuntiveNonDuplicateCalcolate`, `TotaleSpeseCalcolato`, `DifferenzaCalcolata`.
- [x] 1.5 In `backend/Models/ChiusuraMensile.cs` aggiungere il `[NotMapped] SpeseTracciateRegistriCalcolate` = `Σ Registro.SpeseFornitori` dei registri inclusi (`Incluso == true`), simmetrico a `SpeseGiornaliereRegistriCalcolate` (Decision 4).
- [x] 1.6 In `backend/Models/ChiusuraMensile.cs` ridefinire `RicavoNettoCalcolato` = `RicavoTotaleCalcolato − SpeseTracciateRegistriCalcolate − SpeseGiornaliereRegistriCalcolate` (pura aggregazione, niente `SpeseAggiuntiveCalcolate`).
- [x] 1.7 In `backend/Models/ChiusuraMensile.cs` modificare `TotaleDifferenzeCassaCalcolato` per **escludere i registri a sole spese** con la condizione inline `!(r.Registro.TotaleVendite == 0 && r.Registro.TotaleApertura == r.Registro.TotaleChiusura)` sui registri `Incluso == true` (Decision 8, nessun flag persistito).
- [x] 1.8 Eliminare i file `backend/Models/SpesaMensile.cs`, `backend/Models/SpesaMensileLibera.cs`, `backend/Models/PagamentoMensileFornitori.cs` (entità legacy).
- [x] 1.9 In `backend/DataAccess/AppDbContext.cs` estendere la config di `SpesaCassa` con `entity.Property(x => x.Categoria).HasConversion<string>().HasMaxLength(20).IsRequired().HasDefaultValue(CategoriaSpesa.Altro);` (aggiunto anche `.HasSentinel(CategoriaSpesa.Altro)` per correttezza runtime, vedi note).
- [x] 1.10 In `backend/DataAccess/AppDbContext.cs` estendere la config di `PagamentoFornitore` con `entity.Property(x => x.Categoria).HasConversion<string>().HasMaxLength(20);` (nullable, nessun default).
- [x] 1.11 In `backend/DataAccess/AppDbContext.cs` rimuovere i DbSet `SpeseMensili`, `SpeseMensiliLibere`, `PagamentiMensiliFornitori`.
- [x] 1.12 In `backend/DataAccess/AppDbContext.cs` rimuovere i blocchi config `SpesaMensile`, `SpesaMensileLibera`, `PagamentoMensileFornitori`, incluse le relazioni `WithMany(c => c.SpeseLibere)` / `WithMany(c => c.PagamentiInclusi)`. `RegistroCassaMensile` resta invariato.
- [x] 1.13 `dotnet build` del progetto applicativo (`duedgusto.csproj`) verde: 0 warning, 0 errori. NB: i riferimenti ai simboli rimossi in GraphQL/Types, Connection, ChiusureMensili (mutations/queries) e `ChiusuraMensileService` sono stati **rimossi in questa fase** (solo removals, nessuna feature additiva) perché indispensabili a far compilare il progetto e quindi a generare le migrazioni EF di Fase 2. `MigrazioneChiusureMensiliService` eliminato + registrazione DI in `Program.cs` rimossa.

## Phase 2: Backend — Migrazioni EF (solo schema, separate dal codice, ordine add→drop)

- [x] 2.1 Migrazione additiva `20260706084047_AddCategoriaToSpeseCassaEPagamentiFornitori`: `Up` = `ADD COLUMN Categoria varchar(20) NOT NULL DEFAULT 'Altro'` su `SpeseCassa` + `ADD COLUMN Categoria varchar(20) NULL` su `PagamentiFornitori`; `Down` = drop delle 2 colonne. Contiene SOLO le 2 AddColumn (nessun drop tabelle).
- [x] 2.2 Migrazione distruttiva `20260706084205_DropSpeseMensiliSpeseMensiliLiberePagamentiMensiliFornitori`: `Up` = `DROP TABLE PagamentiMensiliFornitori` → `DROP TABLE SpeseMensili` → `DROP TABLE SpeseMensiliLibere` (FK verso `ChiusureMensili`/`PagamentiFornitori`, nessun drop di quelle). `Down` ricrea le 3 tabelle di sola struttura. Contiene SOLO i 3 DropTable. Separazione ottenuta con generazione a stati intermedi (ripristino temporaneo delle entità legacy per la sola migrazione additiva, poi rimozione e generazione della distruttiva).
- [x] 2.3 `AppDbContextModelSnapshot` rigenerato coerentemente: colonne `Categoria` presenti (SpeseCassa NOT NULL default `Altro`, PagamentiFornitori nullable), entità legacy assenti. Le 2 migrazioni sono ordinate per timestamp (`084047` add prima di `084205` drop) per l'auto-apply all'avvio.
- [ ] 2.4 Applicare le migrazioni su un DB pulito (`dotnet ef database update`) e verificare lo schema. NON eseguito in questa fase (auto-apply all'avvio via `Program.cs`, come da istruzioni: non applicare al DB).

## Phase 3: Backend — GraphQL Types & Schema

- [x] 3.1 Registrare/verificare un `EnumerationGraphType<CategoriaSpesa>` nello schema (valori `Affitto|Utenze|Stipendi|Altro`); aggiungerlo se non presente. FATTO: registrato implicitamente via i field `EnumerationGraphType<CategoriaSpesa>` su `SpesaCassaType`/`SpesaCassaInputType`/`PagamentoFornitoreType`/`PagamentoFornitoreInputType`/`PagamentoFornitoreRegistroInputType`/`AggiungiSpesaSuGiornoInputType` (GraphQL.NET registra un unico tipo per CLR type).
- [x] 3.2 In `backend/GraphQL/GestioneCassa/Types/SpesaCassaType.cs` aggiungere il field `categoria` (enum, NOT NULL) su `SpesaCassaType` e il campo `categoria` su `SpesaCassaInput`/`SpesaCassaInputType` (default `Altro` se assente, applicato nell'orchestrator). NON aggiungere `metodoPagamento`.
- [x] 3.3 In `backend/GraphQL/Fornitori/Types/PagamentoFornitoreType.cs` aggiungere il field `categoria` (nullable). Il field legacy `speseMensili` era già assente. Aggiunto `categoria` anche a `PagamentoFornitoreInputType`.
- [x] 3.4 Eliminare i file `SpesaMensileType.cs`, `SpesaMensileInputType.cs`, `SpesaMensileTyperaType.cs`, `SpesaMensileTyperaInputType.cs`, `PagamentoMensileFornitoriType.cs`. (Già fatto in fase compile-fix.)
- [x] 3.5 In `backend/GraphQL/ChiusureMensili/Types/ChiusuraMensileType.cs`: i field KPI PR #7 e `speseLibere`/`pagamentiInclusi` erano già rimossi; aggiunto `speseTracciateRegistriCalcolate`; `ricavoNettoCalcolato` già esposto ridefinito.
- [x] 3.6 In `backend/GraphQL/ChiusureMensili/Types/ChiusuraMensileInputType.cs` nessun riferimento ai tipi legacy residuo. (Già fatto.)

## Phase 4: Backend — Service, mutation e nuova `aggiungiSpesaSuGiorno`

- [x] 4.1 In `MutateRegistroCassaOrchestrator.cs` mappato `Categoria` in `AggiungiSpese` (righe `SpesaCassa`, default `Altro` se assente) e sui `PagamentoFornitore` in `CreaPagamentiNuovi`/`UpdatePagamentiEsistenti` (aggiunto `Categoria` a `PagamentoFornitoreRegistroInput(Type)`). Anche `PagamentoFornitoreOrchestrator.MutateAsync` (dialog) mappa `Categoria` da `PagamentoFornitoreInput`. `CalcolaTotali`/formula `ContanteAtteso` NON toccate.
- [x] 4.2 Definito `AggiungiSpesaSuGiornoInput`/`AggiungiSpesaSuGiornoInputType` in `backend/GraphQL/GestioneCassa/Types/AggiungiSpesaSuGiornoInputType.cs`.
- [x] 4.3 Implementato `AggiungiSpesaSuGiornoOrchestrator` + mutation `aggiungiSpesaSuGiorno` in `GestioneCassaMutations.cs`: applica `GuardMeseChiuso`, NON applica `GuardGiornoOperativoConPeriodi`, blocca registro `RECONCILED`, usa `FindOrCreateRegistroCassaAsync` — Decision 3.
- [x] 4.4 Ramo **non tracciata**: aggiunge `SpesaCassa { Descrizione, Importo, Categoria }`, ricalcola `SpeseGiornaliere` via `MutateRegistroCassaOrchestrator.CalcolaTotali` (reso `internal`, formula invariata, fonte unica) e restituisce il `RegistroCassa`.
- [x] 4.5 Ramo **tracciata**: aggiunge `PagamentoFornitore { DataPagamento=data, Importo, MetodoPagamento (default "Bonifico"), Categoria, RegistroCassaId=registro.Id, FatturaId=null, DdtId=null, Note }` e chiama `RecalculateSpeseFornitoriAsync`.
- [x] 4.6 Guard Decision 9: nel nuovo orchestrator si verifica `reg.Id > 0` dopo il find-or-create e `pagamento.RegistroCassaId != null` prima del save → `ExecutionError`. Il percorso registro (`CreaPagamentiNuovi`) già imposta `RegistroCassaId = registro.Id`.
- [x] 4.7 Metodi legacy `AggiungiSpesaLibera*`/`*PagamentoFornitoreInChiusura`/`IncludiPagamentoFornitore` già rimossi da `ChiusuraMensileService.cs`.
- [x] 4.8 `GetChiusuraConRelazioniAsync` già alleggerito (nessun Include `SpeseLibere`/`PagamentiInclusi`).
- [x] 4.9 `ValidaCompletezzaChiusuraWarningsAsync` già semplificato (nessun riferimento legacy residuo).
- [x] 4.10 `CreaChiusuraAsync` già privo di join `PagamentoMensileFornitori`.
- [x] 4.11 `MigrazioneChiusureMensiliService.cs` già eliminato.
- [x] 4.12 `ChiusureMensiliMutations.cs` già privo delle mutation legacy (spese libere / pagamenti-in-chiusura / include / migra).

## Phase 5: Backend — Connection queries & Dependency Injection

- [x] 5.1 Query `speseMensili` già rimossa da `ConnectionQueries.cs`.
- [x] 5.2 `Include` obsoleti (`SpeseMensili`/`SpeseLibere`/`PagamentiInclusi`) già rimossi da `ConnectionQueries.cs`.
- [x] 5.3 `AddScoped<MigrazioneChiusureMensiliService>()` già rimosso da `Program.cs`; aggiunto `AddScoped<AggiungiSpesaSuGiornoOrchestrator>()`.
- [x] 5.4 `dotnet build duedgusto.csproj` verde: 0 warning, 0 errori; nessun riferimento residuo ai simboli rimossi (verificato via grep).

## Phase 6: Frontend — Tipi TS & GraphQL (fragments/mutations/queries)

- [x] 6.1 In `duedgusto/src/@types/RegistroCassa.d.ts` aggiungere `categoria: CategoriaSpesa` su `SpesaCassa` e ospitare la union `CategoriaSpesa` (spostata da `MonthlyClosure.d.ts`, Decision 6). NB: non esiste una `categoriaOptions` runtime condivisa (i `.d.ts` sono solo tipi ambient); i valori restano in `DEFAULT_CATEGORIE` dentro `SpeseDataGrid.tsx`. Aggiunto anche `categoria?: CategoriaSpesa` a `Spese` (riga griglia cassa) e `categoria?` a `PagamentoFornitoreRegistro`.
- [x] 6.2 In `duedgusto/src/@types/MonthlyClosure.d.ts` rimossi `SpesaMensileLibera`, `PagamentoMensileFornitori`, i 4 KPI PR #7 (`speseAggiuntiveCalcolate`/`speseAggiuntiveNonDuplicateCalcolate`/`totaleSpeseCalcolato`/`differenzaCalcolata`), `speseLibere`, `pagamentiInclusi`, la definizione locale di `CategoriaSpesa` (ora condivisa); aggiunto `speseTracciateRegistriCalcolate`.
- [x] 6.3 In `duedgusto/src/graphql/registroCassa/fragments.tsx` aggiunto `categoria` in `spesaCassaFragment` e nel sotto-fragment inline `pagamentiFornitori` (tipo backend `PagamentoFornitoreType`, espone `categoria`).
- [x] 6.4 In `duedgusto/src/graphql/registroCassa/mutations.tsx` aggiunto `categoria` in `SpesaCassaInput` e in `PagamentoFornitoreRegistroInput`.
- [x] 6.5 In `duedgusto/src/graphql/chiusureMensili/fragments.tsx` rimossi `spesaMensileLiberaFragment`, `pagamentoMensileFornitoriFragment`, i 4 KPI PR #7, `speseLibere`/`pagamentiInclusi`; aggiunto `speseTracciateRegistriCalcolate` (`ricavoNettoCalcolato` già esposto, ridefinito lato backend).
- [x] 6.6 In `duedgusto/src/graphql/chiusureMensili/mutations.tsx` rimosse le mutation spese libere, pagamenti-in-chiusura, `includiPagamentoFornitore` (e relativi tipi/fragment); `migraChiusureMensiliVecchioModello` non era presente lato frontend. Mantenute `creaChiusuraMensile`, `aggiornaGiorniEsclusi`, `chiudiChiusuraMensile`, `eliminaChiusuraMensile`.
- [x] 6.7 In `duedgusto/src/graphql/chiusureMensili/queries.tsx` nessun campo rimosso residuo (le query usano solo `ChiusuraMensileFragment`); nessuna modifica necessaria.
- [x] 6.8 (Opzionale) In `duedgusto/src/graphql/registroCassa/mutations.tsx` aggiunta la mutation `aggiungiSpesaSuGiorno` + tipi (`AggiungiSpesaSuGiornoInput`), con TODO: nessuna UI dedicata prevista dal design corrente.

## Phase 7: Frontend — Componenti

- [x] 7.1 In `RegistroCassaForm.tsx` passato `columns={{ showCategoria: true }}` alla `SpeseDataGrid` del registro.
- [x] 7.2 In `SpeseDataGrid.tsx` verificato: la colonna Categoria (`showCategoria`) funziona in modalità staged (nessuna `persistence`); `getNewExpense` crea le righe nuove con `categoria = "Altro"`; editable solo su righe non-pagamento. Nessuna modifica necessaria.
- [x] 7.3 In `RegistroCassaDetails.tsx` mappata `categoria` in lettura (spese normali da `SpesaCassa.categoria`; pagamenti da `PagamentoFornitoreRegistro.categoria`) e in `RegistroCassaInput` (spese + pagamentiFornitori). Cambiato il tipo del param `spese.map` da `ExpenseRow` a `Spese` per accedere a `categoria`.
- [x] 7.4 In `PagamentoFornitoreDialog.tsx` aggiunta la select `Categoria` opzionale (default vuoto → emesso come `undefined`) per le spese fisse tracciate; stato pre-riempito da `initialData.categoria` in modifica.
- [x] 7.5 In `MonthlyClosureDetails.tsx` rimossi import/`useMutation`/`persistence`/`gridExpenses`/`defaultDate` delle spese-libere+pagamenti-in-chiusura, la `SpeseDataGrid` editabile e `isReadOnly` (inutilizzato); le tre differenze e "Totale Spese" ora derivano da `meseAggregato` (`aggregaRegistriPerMese` sui registri inclusi); rimosso il consumo di `differenzaCalcolata`/`totaleSpeseCalcolato` PR #7 (Decision 5).
- [x] 7.6 In `MonthlyClosureReport.tsx` rimossi i blocchi `speseLibere` e `pagamentiInclusi`; la riga "Totale Spese"/`speseAggiuntiveCalcolate` sostituita da "Spese Tracciate (Registri)" = `speseTracciateRegistriCalcolate` (componente vivo, adeguato).
- [x] 7.7 Eliminati `MonthlyClosureForm.tsx` e `MonthlySummaryView.tsx` (codice morto, zero import esterni verificati). `MonthlyClosureList.tsx` NON toccato.

## Phase 8: Testing — Backend (xUnit, `backend/DuedGusto.Tests`)

- [x] 8.1 `ChiusuraMensileServiceTests` adeguato: rimossi i test spese-libere/pagamenti-in-chiusura/anti-doppio-conteggio PR #7; aggiunto `ComputedProperties_KpiPuri_NettoComeAggregazione` (SpeseTracciate/SpeseGiornaliere/RicavoNetto). Il caso "registro escluso non contribuisce" era già presente e resta verde.
- [x] 8.2 `GetChiusuraConRelazioniAsync`: `SpeseLibere`/`PagamentiInclusi` rimosse dal modello (garanzia a compile-time); test `QueryById_LoadsRegistriInclusi` (in `MonthlyClosuresQueriesTests`) verifica che carica solo `RegistriInclusi.ThenInclude(Registro)` e che i KPI puri sono calcolabili.
- [x] 8.3 Nuovo file `AggiungiSpesaSuGiornoTests.cs`: registro `DRAFT` creato bypassando `GuardGiornoOperativoConPeriodi` (data domenica); `GuardMeseChiuso` mantenuto (mese `CHIUSA` → `ExecutionError`); blocco `RECONCILED`; ramo cash → `SpesaCassa`+Categoria; ramo tracciata → `PagamentoFornitore`+Categoria senza fattura/DDT; idempotenza find-or-create.
- [x] 8.4 **Decision 9**: `AggiungiSpesaSuGiorno_Tracciata_RegistroCassaIdSempreValorizzato_Decision9` verifica `RegistroCassaId` sempre valorizzato (== registro.Id) sul pagamento creato.
- [x] 8.5 **Decision 8**: `TotaleDifferenzeCassa_EscludeRegistriASoleSpese_MantieneDifferenzeReali` — mese con 1 registro vendite (Differenza 10) + 1 registro a sole spese (Differenza 30) → totale = 10 (non 40).
- [x] 8.6 `MonthlyClosuresQueriesTests` adeguato ai symbol rimossi (Include `SpeseLibere`/`PagamentiInclusi` tolti, `AggiungiSpesaLiberaAsync` rimosso, KPI PR #7 sostituiti). NB: i test integrazione replicano la data-access layer (non introspezione schema GraphQL, come da nota nel file); l'assenza dei tipi/mutation rimossi è già garantita a compile-time dal progetto applicativo (Fasi 3-5). Non aggiunta introspezione schema per non introdurre infrastruttura DI assente in questa suite — vedi deviazione.
- [x] 8.7 Round-trip `Categoria` coperto via `aggiungiSpesaSuGiorno`: ramo cash (`Affitto`) e tracciata (`Stipendi`+`Bonifico`) persistono la Categoria; `NonTracciata_CategoriaDefaultAltro` verifica il default `Altro` su `SpesaCassa` quando assente. (Coperto via il nuovo orchestrator anziché `mutateRegistroCassa`, il cui mapping Categoria è privato/statico — vedi deviazione.)
- [x] 8.8 `MigrazioneChiusureMensiliServiceTests` già eliminato; rimossi da `TimestampFieldsTests` i test `SpesaMensile`/`SpesaMensileLibera` (entità eliminate) e da `ChiusuraMensileServiceTests` tutti i test che referenziavano entità/mutation rimosse.

## Phase 9: Testing — Frontend (Vitest + Testing Library)

- [x] 9.1 Adeguato `SpeseDataGrid.test.tsx`: aggiunta la suite "colonna Categoria (registro cassa)" (render tendina con i 4 valori di default, editabile solo su spese normali/non-pagamento, assente senza `showCategoria`, edit staged senza scritture server). NB: l'infrastruttura `persistence` per-riga è stata **lasciata** nel componente (come da nota dell'agent precedente: rimuoverla è un refactor di Fase 7, non test-only); i relativi test restano validi perché esercitano comportamento reale del componente. Nessun mock "spese-libere" era presente (il file usava già `showCategoria: true`).
- [x] 9.2 `RegistroCassaDetails.test.tsx` verde e privo di riferimenti morti. Il test è uno smoke che stubba interamente `RegistroCassaForm` (AG Grid non gira in jsdom), quindi la mappatura `categoria` input/lettura — interna a `RegistroCassaDetails.tsx` via il ref della griglia stubbata — non è direttamente asseribile qui; la copertura della colonna Categoria è fornita da `SpeseDataGrid.test.tsx` (9.1) e la select tracciata da `PagamentoFornitoreDialog.test.tsx`. Nessuna modifica necessaria.
- [x] 9.3 Adeguato `MonthlyClosureDetails.test.tsx`: rimosso lo stub/`vi.mock` di `SpeseDataGrid` (la chiusura non ha più griglia editabile) e il test "persistenza per-riga" (feature legittimamente eliminata); ripuliti i mock morti (`speseLibere`/`pagamentiInclusi`/`differenzaCalcolata`/`totaleSpeseCalcolato`/`speseAggiuntive*`) e aggiunti `speseTracciateRegistriCalcolate`/`speseGiornaliereRegistriCalcolate`. I KPI ora sono asseriti come pura aggregazione dei registri inclusi; la griglia spese non deve più comparire (`queryByTestId("spese-data-grid")` = null).
- [x] 9.4 Nessun test frontend referenzia mutation/tipi morti: gli unici riferimenti (`speseLibere`/`pagamentiInclusi`/`differenzaCalcolata`/`totaleSpeseCalcolato`) erano nei mock di `MonthlyClosureDetails.test.tsx`, ora rimossi (9.3). Verificato via grep: nessun test importa `includiPagamentoFornitore`, `SpesaMensile*`, `MonthlyClosureForm`, `MonthlySummaryView`. Aggiunto nuovo `PagamentoFornitoreDialog.test.tsx` (4 test) per la select Categoria.

## Phase 10: Gate finale & note di deploy

- [ ] 10.1 Gate backend: `cd backend && dotnet build` e `dotnet test` verdi.
- [ ] 10.2 Gate frontend: `cd duedgusto && npm run ts:check && npm run lint && npm run test` verdi.
- [ ] 10.3 **Nota deploy (pre-merge)**: riconfermare su prod i conteggi DB che giustificano l'assenza di migrazione dati — `SpeseMensili = 0`, `SpeseMensiliLibere = 0`, `PagamentiMensiliFornitori = 32` tutti con `PagamentoFornitore.RegistroCassaId` non null (zero orfani), `ChiusureMensili = 2` entrambe `BOZZA`. Se i numeri divergono, rivalutare la strategia migrazione prima del merge.
