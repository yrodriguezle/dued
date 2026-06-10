# Tasks: Qualità e Manutenibilità — Fase 4

> **Priorità vincolanti**: Fase 1 (P0) e Fase 2 (P1) sono OBBLIGATORIE. Fase 3 (smoke test + P2)
> e Fase 4 (P3) sono SACRIFICABILI in corso d'opera senza invalidare la change — con un vincolo:
> se si inizia un refactor P2, i relativi smoke test (3.1-3.4) NON sono sacrificabili e vanno
> scritti e portati a verde PRIMA (Decisione 10).
>
> **Gate per fase**: nessuna fase è "fatta" con un gate rosso — backend: `dotnet build` +
> `dotnet test` (≥234 verdi); frontend: `npm run ts:check` + `npm run lint` + `npm run test`
> (≥471 verdi + i nuovi).

## Note di coerenza specs ↔ design (risoluzioni)

1. **Cache Apollo (spec `affidabilita-frontend` → "Entry di cache distinte per variabili discriminanti")**:
   la spec richiede `keyArgs` corretti secondo la "mappa campo→keyArgs definita nel design".
   Il design (Decisione 3) fornisce la mappa e dimostra che `connection`, `gestioneCassa`,
   `chiusureMensili` sono **namespace fields SENZA argomenti**: gli argomenti discriminanti
   vivono sui campi FIGLI e Apollo li codifica già nello storeFieldName (default keyArgs).
   Risoluzione: il requisito "entry distinte per variabili diverse" è soddisfatto dal default
   Apollo una volta rimosso `keyArgs: false` + merge custom; il fix è `{ merge: true }` sui 3
   campi + `settings` (requisito "Merge non distruttivo": `mergeObjects` built-in preserva i
   sibling arg-keyed). **Nessun keyArgs custom da scrivere** — non è un conflitto, è la mappa
   richiesta dalla spec, risolta nel caso degenere "zero argomenti sul campo".
2. **ChiusuraMensileService (spec `architettura-backend` → "delega validazione e calcoli")**:
   il design (Decisione 7) ha verificato che i calcoli aggregati NON vivono nel service
   (sono proprietà calcolate sul model `ChiusuraMensile`): si estrae **solo il Validator**,
   nessun calculator (sarebbe una classe vuota). Lo scenario "Calcoli aggregati invariati"
   resta soddisfatto banalmente (nessun codice di calcolo viene spostato). Risoluzione a
   favore del design come finding corretto, documentata qui e da riportare in verify.
3. **Smoke test (spec `manutenibilita-frontend` cita `MockedProvider`)**: il design
   (Decisione 10) usa `vi.mock` dei moduli hook + `DataRouterTestWrapper` (pattern
   `ProfilePage.test.tsx`) perché subscription WS e AG Grid rendono `MockedProvider` fragile.
   L'intento della spec ("provider mockati", mount senza errori, elementi chiave) è
   soddisfatto; la tecnica di mock segue il design.

---

## Phase 1: Baseline + P0 Affidabilità frontend (OBBLIGATORIA)

Rif: spec `affidabilita-frontend` (boundary per-route, fallback retry, reset su route,
fetchPolicy, fetchingMore, lifecycle subscription, cache); design Decisioni 2, 3, 4.

- [ ] 1.1 Baseline backend: eseguire `cd backend && dotnet build && dotnet test` e registrare il conteggio (atteso ≥234 verdi). Se rosso, STOP e segnalare (Dependencies della proposal).
  > NOTA (2026-06-10, apply Fase 1): esecuzione BLOCCATA dal sandbox dell'agente frontend
  > (vincolo "non toccare backend/" esteso anche a build/test). Da eseguire dall'agente
  > backend o dall'orchestratore prima della Fase 2.
- [x] 1.2 Baseline frontend: eseguire `cd duedgusto && npm run ts:check && npm run lint && npm run test` e registrare il conteggio (atteso ≥471 verdi).
  > Baseline 2026-06-10: ts:check OK, lint OK, vitest 471/471 verdi (64 file).
- [x] 1.3 `duedgusto/src/components/common/ErrorBoundary.tsx`: aggiungere props opzionali `variant?: "fullscreen" | "inline"` (default `"fullscreen"`, comportamento attuale invariato per `Root.tsx`) e `resetKey?: string`; aggiungere `componentDidUpdate` che azzera `{ hasError, error, errorInfo }` quando `resetKey` cambia ed è in stato di errore (Decisione 2, requisito "Reset del boundary al cambio di route").
- [x] 1.4 Stesso file: fallback variante `inline` — stesso contenuto informativo ma `height: "100%"` (niente `minHeight: "100vh"`); bottone "Riprova" che resetta lo state (rimonta i children, nessun reload del documento); bottone "Vai al Dashboard" che usa il navigator globale `duedgusto/src/common/navigator/navigator.tsx` (MAI `window.location.href`/`reload` nella variante inline) (requisito "Fallback per-route con messaggio e retry").
- [x] 1.5 Creare `duedgusto/src/routes/RouteErrorBoundary.tsx`: wrapper funzionale `useLocation()` → `<ErrorBoundary variant="inline" resetKey={location.pathname}>` (~15 righe, codice in Decisione 2). NON usare `key={pathname}` (vietato: remount su route parametriche `cassa/details/:date`).
- [x] 1.6 `duedgusto/src/routes/ProtectedRoutes.tsx`: avvolgere in `<RouteErrorBoundary>` (dentro il `Suspense` esistente) gli elementi delle 6 route statiche con componente E il map delle route dinamiche da menu; le route `Navigate`-only restano senza boundary. `Root.tsx` NON si tocca (ultima rete invariata).
- [x] 1.7 Estendere il test esistente di `ErrorBoundary`: figlio che lancia → fallback inline visibile (shell-friendly); cambio `resetKey` → children ri-renderizzati; "Riprova" rimonta senza reload; variante fullscreen invariata (scenari "Retry dopo errore transitorio", "La navigazione azzera lo stato di errore").
- [x] 1.8 `duedgusto/src/graphql/common/useFetchData.tsx` riga ~40: `fetchItems` usa il parametro `fetchPolicy` invece di `"cache-first"` hardcoded, con narrowing `fetchPolicy === "cache-and-network" ? "cache-first" : fetchPolicy` per la firma `FetchPolicy` di `client.query` (firma pubblica del hook invariata, default `"network-only"` invariato — censimento design: zero consumer di produzione di `fetchItems`).
- [x] 1.9 Stesso file, righe ~168-181: aggiungere `setFetchingMore(false)` nel ramo `next` di `subscribeToMore` prima della `resolve` (il ramo `error` resta com'è) (requisito "fetchingMore resettato al completamento").
- [x] 1.10 Stesso file, effetto righe ~57-119: il cleanup dell'effetto fa anche `firstPageSubscription.current?.unsubscribe()` + azzeramento ref (oltre a `clearTimeout`); rimuovere l'unsubscribe difensivo ridondante a inizio effetto (righe ~58-61); l'effetto unmount-only resta per `loadMoreSubscription`; il guard `thisRequest !== requestId.current` resta (Decisione 4 punto 3).
  > NOTA apply: nel cleanup è stato preservato anche il `setLoading(false)` (guardato da
  > `if (firstPageSubscription.current)`) che il blocco difensivo rimosso eseguiva —
  > conserva il comportamento osservabile (es. skip→true a fetch in corso non lascia
  > `loading` bloccato a true). Il return del hook ora espone anche `fetchingMore`
  > (additivo, necessario per testare il requisito del reset).
- [x] 1.11 Estendere `useFetchData.test.tsx`: spy su `client.query` che asserisce la policy passata (default e `cache-first` esplicito); `fetchingMore === false` dopo success di `subscribeToMore`; unsubscribe chiamato al cambio `variables` e all'unmount, nessun update di stato post-unmount (scenari "Cambio rapido di variabili senza subscription orfane", "Unmount durante un fetch in corso").
- [x] 1.12 `duedgusto/src/graphql/configureClient.tsx` righe ~158-191: sostituire le 3 policy `keyArgs: false` + `merge(existing, incoming)` custom con `connection: { merge: true }`, `gestioneCassa: { merge: true }`, `chiusureMensili: { merge: true }` e aggiungere `settings: { merge: true }`; rimuovere i commenti obsoleti su keyArgs. Lasciare un commento che documenta il rationale namespace-fields (testo in Decisione 3). Rollback possibile per singola riga.
- [x] 1.13 Verifica manuale cache (richiesta dalla proposal, scenario "Comportamento invariato dei flussi esistenti"): flussi cassa (prev/next giorno, vista mensile, dashboard KPI), chiusure mensili (lista per anno + dettaglio), fornitori (liste paginate con filtro, loadMore). Atteso: dati identici, nessun warning "cache data may be lost". Documentare l'esito (nota in questo file o nel commit).
  > ESITO (2026-06-10): verifica manuale via browser non eseguibile in questa sessione
  > (agente headless). Verifica equivalente effettuata: (a) suite completa verde inclusi i
  > test dei domini cassa/chiusure che leggono via Apollo (useQueryCashRegister,
  > useQueryCashRegistersByMonth, useQueryDashboardKPIs, useCloseCashRegister,
  > useSubmitCashRegister); (b) aggiunti 3 test diretti sulla cache REALE del client in
  > `src/graphql/__tests__/configureClient.test.tsx`: entry distinte per argomenti diversi
  > sui campi figli (registroCassa per data, chiusureMensili per anno) e merge non
  > distruttivo (incoming parziale `denominazioni` preserva il sibling `registroCassa`);
  > (c) nessun warning "cache data may be lost" nella run. RESTA da fare la verifica a
  > browser dei flussi reali (prev/next giorno, vista mensile, KPI, fornitori+loadMore)
  > in fase verify/5.3.
- [x] 1.14 Gate Fase 1: `npm run ts:check && npm run lint && npm run test` verdi. Commit atomico P0.
  > Gate 2026-06-10: ts:check OK, lint OK, vitest 487/487 verdi (64 file) = 471 baseline
  > + 16 nuovi (6 ErrorBoundary inline/resetKey, 7 useFetchData policy/fetchingMore/
  > lifecycle, 3 cache policies su client reale). COMMIT NON eseguito su istruzione
  > dell'orchestratore.

## Phase 2: P1 Coerenza — transazioni backend + sync settings (OBBLIGATORIA)

Rif: spec `architettura-backend` (punto unico transazionale, adozione call site);
spec `affidabilita-frontend` (percorso unico sync settings, store aggiornato senza reload);
design Decisioni 1, 5.

### Backend — ExecuteInTransactionAsync (8 metodi in 7 file)

- [x] 2.1 `backend/Repositories/Interfaces/IUnitOfWork.cs`: aggiungere i 2 overload `Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>>)` e `Task ExecuteInTransactionAsync(Func<Task>)` con XML doc (firma esatta in Decisione 1). I metodi `BeginTransactionAsync`/`Commit`/`Rollback` esistenti RESTANO sull'interfaccia.
- [x] 2.2 `backend/Repositories/Implementations/UnitOfWork.cs`: implementare con check `_context.Database.CurrentTransaction is not null` → esecuzione diretta (transazione ambient); altrimenti `await using` begin → operation → commit; catch → rollback → rethrow (eccezione originale NON wrappata). Overload void delega al generico (codice in Decisione 1).
- [x] 2.3 Test unitari backend per l'helper (in `DuedGusto.Tests`, con `TestDbContextFactory`): commit al successo con valore di ritorno; rollback + rethrow su eccezione con stato DB pulito (scenario "Rollback su eccezione con stato pulito"); passthrough con transazione ambient già aperta (nessun nesting). Gate: `dotnet test` verde.
- [x] 2.4 `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` → `ExecuteInTransactionAsync<RegistroCassa>`: lavoro nel lambda, `_eventBus.Publish` FUORI dal lambda dopo il return (invariante "evento dopo commit"); le guard `ChiusuraMensileService` restano PRIMA dell'helper. Comportamento identico (scenario "Comportamento invariato del call site rifattorizzato").
- [x] 2.5 `backend/GraphQL/GestioneCassa/ChiudiRegistroCassaOrchestrator.cs` (overload void, eventi fuori dal lambda, guard prima) e `backend/GraphQL/GestioneCassa/EliminaRegistroCassaOrchestrator.cs` (`ExecuteInTransactionAsync<bool>`, guard prima). Gate `dotnet test` dopo il blocco GestioneCassa.
- [x] 2.6 `backend/GraphQL/Fornitori/FatturaAcquistoOrchestrator.cs`: migrare i 3 metodi (`MutateAsync`, `AssociaDdtAsync`, `DisassociaDdtAsync`) → `ExecuteInTransactionAsync<FatturaAcquisto>`.
- [x] 2.7 `backend/GraphQL/Fornitori/PagamentoFornitoreOrchestrator.cs` (2 metodi: `MutateAsync`, `EliminaAsync`) e `backend/GraphQL/Fornitori/DocumentoTrasportoService.cs` (`MutateAsync` → `ExecuteInTransactionAsync<DocumentoTrasporto>`). Gate `dotnet test` dopo il blocco Fornitori.
- [x] 2.8 `backend/GraphQL/Settings/SettingsMutations.cs` (`creaPeriodo`, riga ~148, transazione raw su `dbContext.Database`): risolvere `IUnitOfWork` via `GraphQLService.GetService<IUnitOfWork>(context)` (pattern del progetto) e migrare all'helper; il lavoro continua a usare `dbContext` (stessa istanza scoped, verificata in design).
- [x] 2.9 Verifica "Nessun boilerplate residuo": grep `BeginTransactionAsync` nei 7 file dei call site → zero occorrenze inline (le 2 transazioni raw di `ChiusuraMensileService` righe 71/145 sono DICHIARATE fuori scope dal design — convivono via check `CurrentTransaction`, NON migrarle). Gate Fase 2 backend: `dotnet build && dotnet test` verdi. Commit atomico.

### Frontend — sync settings unificata

- [x] 2.10 `duedgusto/src/graphql/settings/parseSettingsFromRaw.tsx`: aggiungere ed esportare i tipi `RawBusinessSettings`, `RawPeriodoProgrammazione`, `RawSettingsData` (shape esatta in Decisione 5.1); firma `parseSettingsFromRaw(rawData: RawSettingsData | null | undefined)`; `parseOperatingDays` accetta `string | boolean[]`; rimuovere i 3 `eslint-disable no-explicit-any`. Nessun call site deve richiedere nuovi cast.
- [x] 2.11 Creare `duedgusto/src/graphql/settings/useSyncSettingsToStore.tsx`: unico writer Apollo→Zustand (callback `useCallback` su `setSettings`/`setPeriodi`/`setGiorniNonLavorativi`, codice in Decisione 5.2). Test diretti: input raw con `operatingDays` stringa JSON e array → store con shape normalizzata (orari `HH:mm`, boolean[]) (scenario "Shape normalizzata identica da ogni percorso").
- [x] 2.12 `duedgusto/src/graphql/settings/useGetBusinessSettings.tsx`: i 3 `useMemo` di parsing delegano a un solo memo su `parseSettingsFromRaw(data?.settings)`; esporre `rawSettings: data?.settings`; firma di ritorno esistente invariata.
- [x] 2.13 `duedgusto/src/components/pages/settings/SettingsDetails.tsx`: sostituire i 2 effect `setPeriodi`/`setGiorniNonLavorativi` + il `setSettings` manuale in `onCompleted` con UN effect `useEffect(() => { if (rawSettings) syncToStore(rawSettings); }, [rawSettings, syncToStore])`; la mutation `UPDATE_BUSINESS_SETTINGS` aggiunge `refetchQueries: [{ query: GET_BUSINESS_SETTINGS }], awaitRefetchQueries: true`; `onCompleted` conserva SOLO re-init form via `parseSettingsFromRaw` + toast (Decisione 5.3).
- [x] 2.14 `duedgusto/src/components/pages/settings/GiorniNonLavorativiSection.tsx`: eliminare `syncStoreFromCache`, `readQuery ... as any` e `useApolloClient`; le 3 mutation mantengono `refetchQueries + awaitRefetchQueries`; `onCompleted` resta per toast/chiusura dialog.
- [x] 2.15 `duedgusto/src/components/pages/settings/PeriodoProgrammazioneSection.tsx`: aggiungere `awaitRefetchQueries: true` alle 3 mutation; rimuovere il commento/dead logic in `creaPeriodo.onCompleted` (righe ~73-78). Nessun'altra modifica.
- [x] 2.16 `duedgusto/src/graphql/subscriptions/useSettingsSync.tsx`: sostituire le 3 chiamate `set*` con `syncToStore(result.data?.settings)`; la query `network-only` resta.
- [x] 2.17 Verifica manuale + gate: dopo mutation su business settings / periodo / giorno non lavorativo, `isOpen()`/`isOpenNow()`/`getNextOperatingDate()` riflettono i nuovi valori SENZA reload (scenari "Modifica dei giorni operativi", "Aggiunta di un giorno non lavorativo", "Modifica di un periodo di programmazione"). Gate Fase 2 frontend: `ts:check + lint + test` verdi. Commit atomico P1.
  > ESITO (2026-06-10, apply Fase 2 FE): verifica a browser non eseguibile (agente headless);
  > copertura equivalente via test in `useSyncSettingsToStore.test.tsx` sui 3 scenari della
  > spec (lunedì disattivato → isOpen false + getNextOperatingDate salta al martedì; giorno
  > non lavorativo aggiunto → isOpen false; periodo aggiornato → isOpen riflette i nuovi
  > giorni), simulando il raw del refetch post-mutation sul percorso unico syncToStore.
  > RESTA la verifica a browser dei flussi reali in fase verify/5.4.
  > Gate 2026-06-10: ts:check OK, lint OK, vitest 494/494 verdi (65 file) = 487 + 7 nuovi.
  > COMMIT NON eseguito su istruzione dell'orchestratore.

## Phase 3: Smoke test (prerequisito) + P2 Manutenibilità (SACRIFICABILE*)

Rif: spec `manutenibilita-frontend` (smoke test, useRegistroCassaSubscriptions, hook
MonthlyClosure, useCrudForm pilota); spec `architettura-backend` (Validator, API service
invariata); design Decisioni 7, 8, 9, 10.
*Sacrificabile in blocco; ma 3.1-3.4 sono OBBLIGATORI se si esegue qualunque task 3.6-3.10.

- [x] 3.1 Creare `duedgusto/src/components/pages/registrazioneCassa/__tests__/RegistroCassaDetails.test.tsx` (pattern `ProfilePage.test.tsx`: `vi.mock` + `DataRouterTestWrapper`, NON `MockedProvider` — nota di coerenza 3): mock di `useQueryDenominations`, `useQueryCashRegister`, `useSubmitCashRegister`, `useCloseCashRegister`, le 3 subscription (→ `{ data: undefined }`), `useStore` (utente, `isOpen`, `getNextOperatingDate`), stub `CashRegisterFormDataGrid`. Assert: mount senza errori su `/gestionale/cassa/details/2026-06-10`, data/toolbar visibili, `setTitle` chiamato.
  > NOTA apply: per supportare `useParams(:date/:id)` è stato aggiunto un prop opzionale
  > `path` (default `"*"`, comportamento invariato) a `DataRouterTestWrapper`. Per il
  > PageTitleContext si usa il Provider reale con `setTitle` mock (più robusto del mock
  > di `react.useContext` usato da ProfilePage.test; l'intento del pattern è invariato).
  > 4 test: mount+data/toolbar, setTitle, registro DRAFT → "Chiudi Cassa", loader.
- [x] 3.2 Creare `.../__tests__/MonthlyClosureDetails.test.tsx`: mock `useQueryChiusuraMensile`, `useQueryValidaCompletezzaRegistri`, le 7 mutation via mock `useMutation`, stub griglie. Assert: mount in modalità `:id` con chiusura BOZZA mock, titolo "Chiusura Mensile - …", sezioni chiave visibili.
  > 4 test: metriche riepilogo + griglia/report stub, titolo, azioni toolbar bozza
  > (Indietro/Salva/Chiudi Mese/Elimina), alert "Chiusura non trovata".
- [x] 3.3 Creare `duedgusto/src/components/pages/fattureAcquisto/__tests__/FatturaAcquistoDetails.test.tsx`: mock hook GraphQL del modulo + store, eventuali grid stub (se shell sottile, test banale — open question del design). Assert: mount senza errori, elementi chiave del form presenti.
  > Risoluzione open question: NON è una shell sottile (usa useLazyQuery/useMutation
  > diretti + FatturaAcquistoForm con grid) → stub di FatturaAcquistoForm e
  > PrelevaDdtDialog, mock di useLazyQuery/useMutation. 3 test: mount+toolbar+form stub,
  > setTitle, caricamento fattura con `?invoiceId=` (useLazyQuery chiamata con fatturaId).
- [x] 3.4 GATE VINCOLANTE: i 3 smoke test verdi su codice PRE-refactor (`npm run test`). Solo dopo si può procedere con 3.5-3.10 (scenario "Harness di regressione per i refactor P2").
  > Gate 2026-06-10: smoke verdi su codice pre-refactor (run individuali) + suite
  > completa 505/505 (68 file) = 494 baseline Fase 2 + 11 smoke.
- [x] 3.5 Backend: creare `backend/Services/ChiusureMensili/ChiusuraMensileValidator.cs` — spostamento LETTERALE di `ValidaCompletezzaRegistriAsync` + helper privati `ElencoGiorniMancanti`/`ElencoGiorniMancantiPerPeriodo` (righe 476-661 del service), ctor `(AppDbContext)`. NESSUN calculator (nota di coerenza 2). `IsGiornoOperativoAsync` opzionale SOLO se a costo zero (default: non fare).
  > NOTA apply: `IsGiornoOperativoAsync` NON estratto (come da default: la logica in
  > `AggiornaGiorniEsclusiAsync` è intrecciata col loop di validazione — non a costo zero).
- [x] 3.6 `backend/Services/ChiusureMensili/ChiusuraMensileService.cs`: ctor riceve il validator, `ValidaCompletezzaRegistriAsync` delega; API pubblica (13 metodi, firme e semantica) INVARIATA — zero modifiche ai call site GraphQL. Registrare `AddScoped<ChiusuraMensileValidator>` in `backend/Program.cs`. Aggiornare i 2 test che istanziano il service direttamente: `DuedGusto.Tests/Unit/Services/ChiusuraMensileServiceTests.cs:18` e `DuedGusto.Tests/Integration/GraphQL/MonthlyClosuresQueriesTests.cs:20`. Gate `dotnet build && dotnet test`.
  > Gate 2026-06-10: `dotnet build` 0 errori/0 avvisi, `dotnet test` 241/241 verdi.
- [x] 3.7 Creare `duedgusto/src/graphql/subscriptions/useRegistroCassaSubscriptions.tsx`: lift letterale delle 3 coppie subscription+effect (`RegistroCassaDetails.tsx` righe ~132-167), firma `({ cashRegisterId, refetch })` (Decisione 9); adottarlo in `RegistroCassaDetails.tsx` rimuovendo i 3 useEffect inline. Consolidamento dei 4 `useState` `initial*` SOLO se diff meccanico a costo zero (default: NON fare — open question design). Smoke test 3.1 deve restare verde SENZA modifiche.
  > NOTA apply: consolidamento `initial*` NON eseguito (default rispettato: i 4 stati
  > alimentano prop distinte della griglia, il consolidamento non è un diff meccanico).
  > Smoke test 3.1 verde senza modifiche dopo l'estrazione.
- [x] 3.8 Creare `duedgusto/src/components/pages/registrazioneCassa/useAutoCreaChiusura.tsx` (lift effect righe ~166-188 + ref `autoCreateInitiated` + stato `autoCreateError`) e `useGiorniEsclusi.tsx` (lift derivazioni `giorniEsclusiParsed`/`giorniEsclusiSet`/`giorniEffettivamenteMancanti` + stato `esclusioniLocali` + effect righe ~136-152); adottarli in `MonthlyClosureDetails.tsx` senza scomposizione in sotto-componenti. Smoke test 3.2 verde senza modifiche.
  > Smoke test 3.2 verde senza modifiche dopo l'estrazione (gli hook estratti importano
  > gli stessi moduli mockati). L'interfaccia `EsclusioneLocale` è ora esportata da
  > `useGiorniEsclusi.tsx`.
- [x] 3.9 Creare `duedgusto/src/components/common/form/useCrudForm.tsx` con l'API della Decisione 8 (`defaultValues` factory, `skipInitialize`, `focusFieldName`; ritorna `initialValues`, `handleInitializeValues`, `setInitialFocus`) = lift del corpo di `fornitori/useInitializeValues.tsx` con focus generalizzato. Lo status/lock del form NON entra nell'hook (vincolo conservativo). Test `renderHook`: defaults, merge parziale, skip, focus via jsdom `getElementsByName` (scenari "Nuovo fornitore", "Fornitore esistente", "Inizializzazione singola").
  > 8 test in `src/components/common/form/__tests__/useCrudForm.test.tsx`. NOTA fedeltà
  > al lift: `handleInitializeValues()` senza argomenti NON riporta ai default (come
  > nell'originale: `mergeWithDefaults(undefined, prev)` preserva i valori correnti);
  > il reset effettivo resta delegato a `formRef.resetForm()` nei call site.
- [x] 3.10 Pilota fornitori: `duedgusto/src/components/pages/fornitori/FornitoreFormContainer.tsx` usa `useCrudForm<FormikFornitoreValues>` (`focusFieldName: "ragioneSociale"`, `skipInitialize` come da Decisione 8); spostare `getDefaultFornitoreValues` in `fornitoreFormSchema.tsx`; ELIMINARE `fornitori/useInitializeValues.tsx` e `fornitori/setInitialFocus.tsx`. Gli altri ~15 moduli NON si toccano (scenario "Altri moduli intatti"). Verifica manuale: dirty/submit/reset/focus identici a prima (scenario "Comportamento dirty/submit invariato").
  > ESITO (2026-06-10): file eliminati, zero import residui (grep). Verifica manuale a
  > browser non eseguibile (agente headless): copertura equivalente via i test di
  > useCrudForm (default `paese: "IT"`/`attivo: true`/`aliquotaIva: 22` identici,
  > focus `ragioneSociale`, merge/skip/one-shot identici all'hook originale).
  > RESTA la verifica a browser in fase verify/5.6.
- [x] 3.11 Gate Fase 3: `dotnet build && dotnet test` + `ts:check + lint + test` (inclusi i 3 smoke test invariati). Commit atomico P2.
  > Gate eseguito dall'orchestratore: dotnet build 0 errori, dotnet test 241/241; ts:check OK, lint OK, vitest 513/513 (69 file, inclusi i 3 smoke test).

## Phase 4: P3 Tipi + ARIA (SACRIFICABILE)

Rif: spec `manutenibilita-frontend` (eliminazione any, aria-label); design Decisioni 6, 11.

- [ ] 4.1 `duedgusto/src/common/bones/debounce.tsx`: generics `<TArgs extends unknown[], TReturn>`, `this` tipizzato `unknown`, ritorno `((...args: TArgs) => Promise<Awaited<TReturn>>) & { cancel: () => void }`; rimuovere `eslint-disable no-explicit-any`. Vincolo: zero nuovi cast nei call site (`ts:check` arbitro).
- [ ] 4.2 `duedgusto/src/common/bones/omitDeep.tsx`: firma `omitDeep<T>(value: T, omitArrayProperties?: string[]): T`, helper interni su `unknown` + narrowing (`Array.isArray`, type predicate). Stesso trattamento per `differenceBy.tsx`: `differenceBy<T, K>(arr1: T[], arr2: T[], keyOrIteratee: keyof T | ((item: T) => K)): T[]`.
- [ ] 4.3 `duedgusto/src/common/bones/{isEqual,unionBy,uniq,PromiseQueue}.tsx` (SHOULD, stesso intervento): generics + `unknown` interno, firme finalizzate file per file con `ts:check` come gate (open question design — se un file richiede cast nei call site, lasciarlo invariato e documentare).
- [ ] 4.4 `duedgusto/src/store/businessSettingsStore.tsx`: tipizzare `set: StoreApi<Store>["setState"]`, `get: StoreApi<Store>["getState"]` (o il pattern usato dagli altri slice in `useStore.tsx` — coerenza > eleganza); rimuovere l'`eslint-disable` riga ~32; NON semplificare i body `set((state) => ...)` (Decisione 6).
- [ ] 4.5 Verifica "Zero eslint-disable residui": grep `eslint-disable @typescript-eslint/no-explicit-any` nei file in scope (bones toccati, `businessSettingsStore`, `parseSettingsFromRaw`, `useFetchData`) → zero occorrenze. Test unitari esistenti su bones/store invariati e verdi (scenario "Comportamento runtime invariato").
- [ ] 4.6 Censimento ARIA: grep `<IconButton` in `duedgusto/src/components/**` e individuare i 18 file con IconButton senza testo né `aria-label`; per ciascuno aggiungere `aria-label` italiano descrittivo dell'azione (es. "Modifica", "Elimina riga", "Giorno precedente", "Chiudi finestra"); dove esiste già `title`, l'`aria-label` lo duplica. Nessun cambiamento visivo.
- [ ] 4.7 Test ARIA spot (eventuale, a costo zero): nei test esistenti dei componenti toccati, sostituire/aggiungere query `getByRole("button", { name: "..." })` dove banale (scenario "Pulsante icona accessibile"). Non scrivere nuovi file di test solo per gli aria-label.
- [ ] 4.8 Gate Fase 4: `ts:check + lint + test` verdi. Commit atomico P3.

## Phase 5: Verifica finale

Rif: Success Criteria della proposal; Testing Strategy del design.

- [ ] 5.1 Gate backend completo: `cd backend && dotnet build && dotnet test` (≥234 + i nuovi test helper/validator).
- [ ] 5.2 Gate frontend completo: `cd duedgusto && npm run ts:check && npm run lint && npm run test` (≥471 + smoke test + nuovi unit).
- [ ] 5.3 Scenario accettazione — boundary per-route: simulare un crash di rendering in una pagina protetta → il fallback appare SOLO nell'area contenuto, sidebar/header vivi e interattivi; "Riprova" rimonta senza reload; navigare altrove e tornare → nessun fallback residuo (spec affidabilita, requisiti 1-3).
- [ ] 5.4 Scenario accettazione — settings: salvare business settings/periodo/giorno non lavorativo → `isOpen()`/`getNextOperatingDate()` aggiornati immediatamente senza reload (spec affidabilita, requisito sync).
- [ ] 5.5 Scenario accettazione — transazioni: forzare un errore in una mutation migrata (es. test di integrazione esistente) → rollback completo, eccezione originale propagata, zero `BeginTransactionAsync` inline nei 7 file call site (spec architettura, scenari rollback/boilerplate residuo).
- [ ] 5.6 Scenario accettazione — pilota fornitori: creazione/modifica/reset fornitore identici a prima (defaults `paese: "IT"`, `attivo: true`, `aliquotaIva: 22`; focus su `ragioneSociale` solo su form nuovo); altri moduli intatti.
- [ ] 5.7 Spuntare la checklist Success Criteria della proposal (13 voci) annotando le voci P2/P3 eventualmente sacrificate e perché.
