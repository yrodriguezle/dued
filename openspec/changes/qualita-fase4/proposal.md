# Proposal: Qualità e Manutenibilità — Fase 4

## Intent

Fase 4 del piano post-audit: ridurre il debito tecnico di qualità e manutenibilità emerso dall'audit frontend/backend, **senza alcuna modifica funzionale visibile** (refactor conservativi, comportamento invariato, test esistenti verdi). L'esplorazione del codice ha verificato i finding dell'audit e ne ha **corretti/ridimensionati alcuni** rispetto al testo originale:

### Finding verificati (con correzioni dall'esplorazione)

| # | Finding audit | Stato verificato |
|---|---------------|------------------|
| F1 | "Nessun ErrorBoundary in tutta l'app" | **Parzialmente superato**: `src/components/common/ErrorBoundary.tsx` esiste (con test) ed è montato in `src/routes/Root.tsx:69` al top-level. Manca però la granularità **per-route**: un crash in una pagina caricata dinamicamente (`ProtectedRoutes.tsx`) smonta l'intera shell (sidebar, header, layout) invece della sola pagina. |
| F2 | Bug `fetchPolicy` in `useFetchData` | **Confermato**: `src/graphql/common/useFetchData.tsx:40` — il callback `fetchItems` usa `fetchPolicy: "cache-first"` hardcoded ignorando il parametro (default `"network-only"`). Trovato inoltre: `fetchingMore` non viene mai riportato a `false` dopo un caricamento riuscito in `subscribeToMore` (righe 130, 168-181: solo il ramo error fa `setFetchingMore(false)`), e il ciclo di vita delle subscription è fragile (l'effetto di fetch a riga 57-119 fa cleanup solo del timeout; la subscription intermedia viene chiusa solo alla run successiva o all'unmount). |
| F3 | Apollo cache: merge shallow con `keyArgs: false` | **Confermato**: `src/graphql/configureClient.tsx:158-191` — i campi `connection`, `gestioneCassa` e `chiusureMensili` usano `keyArgs: false` + merge shallow `{ ...existing, ...incoming }`. Query con filtri/variabili diversi vengono mergiate nella stessa entry di cache; gli array annidati dentro l'oggetto vengono sovrascritti per intero dal solo spread shallow (perdita dati quando `incoming` ha un sottoinsieme dei campi). |
| F4 | "Le mutation settings aggiornano Apollo ma non Zustand" | **Ridimensionato**: la sync esiste ma è **frammentata in 3+ meccanismi diversi e incoerenti** — `SettingsDetails.tsx` fa `setSettings` manuale in `onCompleted` con parsing inline duplicato (non usa `parseSettingsFromRaw`); `GiorniNonLavorativiSection.tsx` legge la cache con `readQuery ... as any` dopo `awaitRefetchQueries`; `PeriodoProgrammazioneSection.tsx` si affida solo al refetch + `useEffect` nel padre; `useSettingsSync.tsx` (subscription, montato in `Layout`) rifà la query network-only. Il rischio di divergenza/stantio è nelle cuciture tra questi percorsi, non nell'assenza totale di sync. |
| F5 | Pattern transazione duplicato negli orchestrator backend | **Confermato e più ampio del previsto**: boilerplate `BeginTransactionAsync / try / Commit / catch / Rollback` ripetuto in 7+ call site: `MutateRegistroCassaOrchestrator`, `FatturaAcquistoOrchestrator` (3 metodi), `PagamentoFornitoreOrchestrator`, `ChiudiRegistroCassaOrchestrator`, `EliminaRegistroCassaOrchestrator`, `DocumentoTrasportoService`, `SettingsMutations`. |
| F6 | `ChiusuraMensileService` 635+ righe | **Confermato**: 662 righe, 13 metodi pubblici che mischiano CRUD, validazione completezza registri (`ValidaCompletezzaRegistriAsync` + 2 helper privati di calcolo giorni, righe 476-661) e calcoli aggregati. |
| F7 | Duplicazione CRUD frontend (~24 ripetizioni) | **Confermato**: `useInitializeValues.tsx` duplicato per-modulo in 16 file di pagine, `setInitialFocus.tsx` in 21 file. Pattern Details/Form/List ripetuto in users, fornitori, roles, menu, fattureAcquisto, documentiTrasporto, ecc. |
| F8 | ~86 `any` da eliminare | **Confermato (ordine di grandezza)**: ~41 occorrenze non-test + 25 file con `eslint-disable no-explicit-any`, concentrate in `src/common/bones/` (debounce, omitDeep, differenceBy, isEqual, unionBy, uniq, PromiseQueue), `businessSettingsStore.tsx:33` (`set: any`), `parseSettingsFromRaw.tsx`, `useFetchData.tsx`, wrapper Formik. |
| F9 | Accessibilità minima | **Ridimensionato**: `index.html` ha già `lang="it"`; `Layout.tsx` ha già `component="main"` e `NestedList` `component="nav"`. Restano gli `aria-label` sugli IconButton: 18 dei 20 file componente con `IconButton` non hanno alcun `aria-label`. |
| F10 | 0% test sui componenti pagina | **Confermato**: solo 3 file di test sotto `src/components/pages/` (nessuno per `RegistroCassaDetails`, `MonthlyClosureDetails`, `FatturaAcquistoDetails`). |
| F11 | `RegistroCassaDetails` / `MonthlyClosureDetails` monolitici | **Ridimensionato sui numeri, confermato nella sostanza**: `RegistroCassaDetails.tsx` è 629 righe con 7 `useState` (non 27) e **3 subscription + 3 `useEffect` quasi identici** (righe 132-167: stesso pattern "se evento riguarda il registro corrente → refetch") ideali per un hook `useRegistroCassaSubscriptions`. `MonthlyClosureDetails.tsx` è 945 righe. Percorso reale: `src/components/pages/registrazioneCassa/` (non `cashRegister/`/`monthlyClosure/`). |

## Scope

Le deliverable sono prioritizzate. P0/P1 sono il cuore della change; P2/P3 sono inclusi ma sacrificabili in corso d'opera senza invalidare la change.

### In Scope

**P0 — Resilienza (bug reali, comportamento corretto atteso)**

1. **ErrorBoundary per-route**: avvolgere l'elemento di ogni route in `ProtectedRoutes.tsx` (sia le route statiche sia quelle dinamiche da menu) con un boundary che isola il crash alla sola pagina, preservando Layout/sidebar e offrendo retry/navigazione. Riuso del componente esistente (eventuale variante "inline" con reset su cambio route via `key`/`resetKeys`). Il boundary top-level in `Root.tsx` resta come ultima rete.
2. **Fix `useFetchData`** (`src/graphql/common/useFetchData.tsx`):
   - `fetchItems` rispetta il parametro `fetchPolicy` (riga 40);
   - `setFetchingMore(false)` anche nel ramo success di `subscribeToMore`;
   - ciclo di vita subscription robusto: unsubscribe deterministico della subscription corrente nel cleanup dell'effetto (non solo del timeout), nessuna subscription orfana tra le run.
3. **Apollo cache type policies** (`src/graphql/configureClient.tsx`): sostituire i tre merge shallow `keyArgs: false` con policy corrette — `keyArgs` espliciti sulle variabili discriminanti dove il campo è parametrico, e merge che non perda gli array annidati (o `merge: true`/replace consapevole documentato). Nessun cambiamento osservabile nei dati renderizzati, solo correttezza di cache.

**P1 — Coerenza**

4. **Sync settings unificata**: un unico percorso Apollo→Zustand basato su `parseSettingsFromRaw` (già esistente) — es. hook `useSyncSettingsToStore` o helper unico richiamato da `SettingsDetails`, `GiorniNonLavorativiSection`, `PeriodoProgrammazioneSection` e `useSettingsSync`; eliminazione del parsing inline duplicato e del `readQuery ... as any`. `isOpen()`/`getNextOperatingDate()` leggono sempre dati freschi dopo ogni mutation senza reload.
5. **Helper transazionale backend**: estrazione del boilerplate transazione in un punto unico — `ExecuteInTransactionAsync(Func<Task<T>>)` su `IUnitOfWork`/`UnitOfWork` (o `BaseOrchestrator`) — e adozione nei 7+ call site individuati (F5). Semantica identica: stesso ordine begin/commit/rollback, stesse eccezioni propagate.

**P2 — Manutenibilità**

6. **Estrazione hook da `RegistroCassaDetails.tsx`** (conservativa): `useRegistroCassaSubscriptions({ cashRegisterId, refetch })` che incapsula le 3 subscription + 3 effect identici; eventuale consolidamento dello stato `initial*` (4 useState correlati) in un unico oggetto SOLO se a costo zero di comportamento. Nessuna ristrutturazione del render.
7. **Estrazione hook da `MonthlyClosureDetails.tsx`** (conservativa): estrazione di custom hook per blocchi di logica auto-contenuti (subscription/derivazioni), SENZA scomposizione in sotto-componenti.
8. **`useCrudForm<T>` — solo modulo pilota**: hook generico in `src/components/common/form/` (o `src/graphql/common/`) che assorbe il pattern duplicato `useInitializeValues` + `setInitialFocus` + status/lock del form; applicato al SOLO modulo **fornitori** (candidato verificato: 715 righe totali, pattern completo e semplice). Gli altri ~15 moduli restano invariati (rollout in change future).
9. **Scomposizione `ChiusuraMensileService`** (backend): estrazione di `ChiusuraMensileValidator` (completezza registri: `ValidaCompletezzaRegistriAsync`, `ElencoGiorniMancanti`, `ElencoGiorniMancantiPerPeriodo`) e di un calculator per gli aggregati, con il service che delega. API pubblica del service invariata (firma e semantica), per non toccare i call site GraphQL.

**P3 — Tipi, ARIA, test**

10. **Tipizzazione**: eliminare `any` con generics/tipi espliciti in `src/common/bones/` (debounce, omitDeep, differenceBy, isEqual, unionBy, uniq), `businessSettingsStore` (tipizzare `set` con il tipo Zustand `StateCreator`/firma corretta), `parseSettingsFromRaw` (input tipizzato sulla shape della query). Target: rimozione degli `eslint-disable no-explicit-any` nei file toccati; gli `any` residui in file non in scope (wrapper Formik, datagrid) sono documentati come lavoro futuro.
11. **ARIA**: `aria-label` sugli `IconButton` privi di testo nei 18 file individuati (stringa italiana descrittiva dell'azione). Niente altro: `lang` e landmark sono già a posto (F9).
12. **Smoke test componenti pagina critici**: rendering happy-path con provider mockati (Apollo `MockedProvider`, store, router) per `RegistroCassaDetails`, `MonthlyClosureDetails`, `FatturaAcquistoDetails` — verifica che montino senza errori e mostrino gli elementi chiave. Servono anche da harness di regressione per i refactor P2 (vanno scritti PRIMA delle estrazioni hook).

### Out of Scope

- **Permission check per-componente** (richiede estensione del modello `Menu` con flag tipo `canEdit` — change futura dedicata, con migrazione DB).
- **Guard su registri/mesi chiusi** (deferred per decisione utente, come nelle fasi 2-3).
- **Rollout `useCrudForm` sugli altri moduli** (~15 moduli oltre il pilota fornitori — change future, una volta validato il pattern).
- **Refactor completo di `MonthlyClosureDetails` in sotto-componenti** (solo estrazione hook conservativa in questa fase).
- **Tipizzazione esaustiva di tutti gli `any`** (wrapper Formik/datagrid/logger fuori dai file elencati al punto 10).
- **Audit accessibilità completo** (contrasto, focus management, screen reader flow): solo gli `aria-label` mancanti.
- **CI/CD e coverage gate automatici**: i gate restano manuali (vedi Success Criteria).

## Approach

1. **Ordine di esecuzione = ordine di priorità**, con un'eccezione: gli smoke test (P3.12) sui componenti che verranno rifattorizzati si scrivono **prima** delle estrazioni hook (P2.6-7), così fanno da rete di sicurezza.
2. **Refactor conservativi**: ogni item P1/P2 mantiene firme pubbliche e comportamento osservabile. Backend: `ExecuteInTransactionAsync` replica esattamente la semantica attuale (begin → lavoro → commit; catch → rollback → rethrow); il validator/calculator estratti da `ChiusuraMensileService` sono spostamenti di codice, non riscritture. Frontend: gli hook estratti sono "lift" del codice esistente.
3. **Cache Apollo (P0.3) è l'item più delicato**: la correzione di `keyArgs` cambia la granularità delle entry di cache. Strategia: per ogni campo (`connection`, `gestioneCassa`, `chiusureMensili`) ricostruire dal codice quali variabili discriminano davvero le query (il design documenterà la mappa campo→keyArgs), verificare a mano i flussi cassa/chiusure dopo la modifica, e mantenere la possibilità di rollback per singolo campo.
4. **`useCrudForm<T>` pilota**: si progetta sull'intersezione reale dei 16 `useInitializeValues` duplicati (sono quasi identici: merge defaults + skip + focus iniziale). Il pilota fornitori dimostra il pattern; l'API dell'hook è progettata per il rollout futuro ma NON si tocca nessun altro modulo.
5. **Gate di verifica** dopo ogni blocco di priorità: `dotnet build` + `dotnet test` (234 test verdi), `npm run ts:check` + `npm run lint` + `npm run test` (471 test verdi + i nuovi). Nessun item è "fatto" se un gate è rosso.

Moduli coinvolti: **backend + frontend**. Migrazioni DB: **no** (nessuna modifica a modelli/schema).

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `duedgusto/src/routes/ProtectedRoutes.tsx` | Modified | Boundary per-route attorno agli elementi pagina |
| `duedgusto/src/components/common/ErrorBoundary.tsx` | Modified | Variante/props per uso inline per-route (reset su cambio route) |
| `duedgusto/src/graphql/common/useFetchData.tsx` | Modified | Fix fetchPolicy, fetchingMore, lifecycle subscription |
| `duedgusto/src/graphql/configureClient.tsx` | Modified | Type policies corrette (keyArgs/merge) per connection, gestioneCassa, chiusureMensili |
| `duedgusto/src/graphql/settings/parseSettingsFromRaw.tsx` | Modified | Tipizzazione input + unico punto di parsing |
| `duedgusto/src/components/pages/settings/*.tsx` | Modified | Sync Apollo→Zustand unificata (SettingsDetails, GiorniNonLavorativiSection, PeriodoProgrammazioneSection) |
| `duedgusto/src/graphql/subscriptions/useSettingsSync.tsx` | Modified | Allineato al percorso di sync unico |
| `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | Modified | Estrazione useRegistroCassaSubscriptions, consolidamento stato a costo zero |
| `duedgusto/src/components/pages/registrazioneCassa/MonthlyClosureDetails.tsx` | Modified | Estrazione hook conservativa |
| `duedgusto/src/graphql/subscriptions/` (nuovo hook) | New | `useRegistroCassaSubscriptions.tsx` |
| `duedgusto/src/components/common/form/` (nuovo hook) | New | `useCrudForm.tsx` generico |
| `duedgusto/src/components/pages/fornitori/*.tsx` | Modified | Pilota useCrudForm (rimozione useInitializeValues/setInitialFocus locali) |
| `duedgusto/src/common/bones/*.tsx` | Modified | Generics al posto di any (debounce, omitDeep, differenceBy, isEqual, unionBy, uniq) |
| `duedgusto/src/store/businessSettingsStore.tsx` | Modified | Tipizzazione `set` |
| `duedgusto/src/components/**` (18 file) | Modified | aria-label su IconButton |
| `duedgusto/src/components/pages/**/__tests__/` | New | Smoke test RegistroCassaDetails, MonthlyClosureDetails, FatturaAcquistoDetails |
| `backend/Repositories/Interfaces/IUnitOfWork.cs` + `Implementations/UnitOfWork.cs` | Modified | `ExecuteInTransactionAsync` |
| `backend/GraphQL/GestioneCassa/*Orchestrator.cs` (3 file) | Modified | Adozione helper transazionale |
| `backend/GraphQL/Fornitori/*.cs` (3 file) | Modified | Adozione helper transazionale |
| `backend/GraphQL/Settings/SettingsMutations.cs` | Modified | Adozione helper transazionale |
| `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` | Modified | Delega a validator/calculator estratti |
| `backend/Services/ChiusureMensili/` (nuovi file) | New | `ChiusuraMensileValidator.cs`, calculator aggregati |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| La modifica delle cache type policies (keyArgs) altera il comportamento di liste/dettagli (dati mancanti o refetch extra) | Med | Mappa campo→variabili discriminanti documentata nel design; verifica manuale dei flussi cassa/chiusure/fornitori; rollback per singolo campo (ogni policy è indipendente) |
| `useFetchData` fix fetchPolicy cambia il comportamento di chi si affidava (involontariamente) a cache-first in `fetchItems` | Low | Censimento dei call site di `fetchItems` prima del fix; default del parametro invariato |
| L'helper transazionale introduce differenze sottili (dispose, eccezioni wrappate) rispetto al boilerplate | Low | Replica letterale della semantica esistente; 234 test backend come gate; adozione call site per call site |
| Estrazione hook da RegistroCassaDetails/MonthlyClosureDetails rompe sequenze di effect (ordini di refetch) | Med | Smoke test scritti PRIMA del refactor; estrazione "lift" senza riordinare le dipendenze; diff review mirata |
| useCrudForm troppo generico/astratto al primo colpo | Med | Solo pilota fornitori; API derivata dall'intersezione reale dei duplicati, non da casi ipotetici |
| Tipizzazione bones introduce breaking nei call site (inference più stretta) | Low | `ts:check` come gate; i tipi devono accettare tutti gli usi attuali senza cast nei call site |
| Scope creep (12 deliverable) | Med | Prioritizzazione P0→P3 vincolante; P2/P3 sacrificabili senza invalidare la change; tasks.md raggrupperà per priorità |

## Rollback Plan

- Nessuna migrazione DB e nessun cambiamento di schema GraphQL: il rollback è puramente applicativo.
- Ogni priorità (P0, P1, P2, P3) viene committata in commit separati e auto-consistenti: revert selettivo per blocco senza toccare gli altri.
- Le cache policies (item più rischioso) sono rollbackabili per singolo campo ripristinando la policy precedente in `configureClient.tsx`.
- L'helper transazionale backend convive col pattern manuale: in caso di problemi su un call site si ripristina il boilerplate solo lì.
- Il pilota `useCrudForm` è confinato a fornitori: revert del solo modulo ripristina lo stato attuale (i file `useInitializeValues`/`setInitialFocus` locali si recuperano dal commit precedente).

## Dependencies

- Nessuna dipendenza esterna nuova (no librerie aggiunte: l'ErrorBoundary esistente viene riusato, niente `react-error-boundary`).
- Baseline test verde: 234 test backend e 471 test vitest passanti prima di iniziare (da riconfermare con una run all'avvio dell'apply).
- Le change `fix-salvataggio-cassa-fase1`, `coerenza-calcoli-fase2`, `iva-multialiquota-fase3` devono essere stabili sui file condivisi (orchestrator gestione cassa, RegistroCassaDetails): coordinare se ancora in corso.

## Success Criteria

- [ ] Un errore di rendering in una pagina mostra il fallback SOLO nell'area contenuto: sidebar e header restano funzionanti e si può navigare altrove senza reload.
- [ ] `useFetchData`: `fetchItems` usa la `fetchPolicy` passata; `fetchingMore` torna `false` dopo ogni load (successo ed errore); nessuna subscription attiva dopo l'unmount o tra run consecutive dell'effetto.
- [ ] Cache Apollo: due query dello stesso campo con variabili diverse non si sovrascrivono più a vicenda; i dati annidati non vengono persi al merge (verifica manuale flussi cassa/chiusure documentata).
- [ ] Dopo ogni mutation settings (business settings, periodi, giorni non lavorativi) lo Zustand store riflette i nuovi valori senza reload: `isOpen()`/`getNextOperatingDate()` corretti immediatamente.
- [ ] Zero occorrenze di `BeginTransactionAsync` inline negli orchestrator/mutations elencati: tutti passano dall'helper unico.
- [ ] `ChiusuraMensileService` delega validazione e calcoli a classi estratte; API pubblica invariata.
- [ ] `RegistroCassaDetails.tsx` non contiene più i 3 useEffect di subscription inline (hook estratto); nessun cambiamento di comportamento osservabile.
- [ ] Modulo fornitori funzionante con `useCrudForm<T>`; i file `useInitializeValues.tsx`/`setInitialFocus.tsx` locali di fornitori eliminati; gli altri moduli intatti.
- [ ] Zero `eslint-disable @typescript-eslint/no-explicit-any` nei file in scope (bones elencati, businessSettingsStore, parseSettingsFromRaw, useFetchData).
- [ ] Tutti gli IconButton senza testo nei 18 file individuati hanno `aria-label` italiano.
- [ ] Smoke test di rendering verdi per RegistroCassaDetails, MonthlyClosureDetails, FatturaAcquistoDetails.
- [ ] Gate finali tutti verdi: `dotnet build`, `dotnet test` (≥234 passed), `npm run ts:check`, `npm run lint`, `npm run test` (≥471 passed).
