# Tasks: Redesign Dashboard con Grafici (dashboard-charts-redesign)

> **Vincoli per l'apply (non negoziabili)**
>
> - Ogni sub-agent di apply DEVE invocare le skill di progetto **`react-best-practices`** (pattern pagina/hook/stato, anti-loop, EMPTY_ARRAY stabile) e **`interface-design`** (gerarchia, densità, coerenza tema) PRIMA di scrivere codice frontend.
> - **Correzioni vincolanti dal design** (prevalgono sul proposal e, dove in conflitto, sulla delta spec `gestione-cassa`):
>   1. Libreria grafici: `@mui/x-charts@^8` (NON ^9 — la 9 richiede `@mui/material ^7.3+`, il progetto è su 6.4.8).
>   2. La query backend `riepilogoMensile` NON esiste: `riepilogoAnnuale(anno)` va creata **da zero** con i nuovi tipi `RiepilogoMeseCassa` / `RiepilogoAnnualeCassa` (nessuna estensione di un tipo esistente). La query frontend `GetRiepilogoMensile` è codice morto (solo annotazione `@deprecated`, cleanup fuori scope).
>   3. Architettura: orchestratore snello + 9 file sotto `duedgusto/src/components/pages/registrazioneCassa/dashboard/`, hook `useDashboardData`, `useChartPalette`, modulo formule unico `aggregaRegistri.tsx`, Sankey Recharts lazy con error boundary e fallback a barre impilate x-charts.
> - Regole `rules.apply` di `openspec/config.yaml`: file frontend `.tsx`, iterazione funzionale (no `for`), utilities `bones/` (no lodash), resolver con `GraphQLService.GetService<T>()`.
> - Formule normative: spec `dashboard-cassa` § "Definizioni e Formule"; riferimento vivo `VistaMensile.tsx` (righe 84-107).
>
> **Batching consigliato per sub-agent di apply**: ogni fase è un batch autonomo. Fase 1 (backend) e Fase 2 (data layer FE) sono parallelizzabili tra loro; Fase 3 dipende da Fase 2; Fase 4 dipende da Fase 2 e 3.1; Fase 5 dipende da tutte.

---

## Fase 1 — Backend: query aggregata `riepilogoAnnuale` + test xUnit

> Dipendenze: nessuna. Deployabile per prima (additiva, read-only, nessuna migrazione EF).
> Batch: 1 sub-agent (1.1 → 1.4 in sequenza).

- [x] **1.1 Creare i modelli C# `RiepilogoMeseCassa` e `RiepilogoAnnualeCassa`**
  - File: `backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs` (o file dedicato adiacente, seguendo la convenzione del modulo)
  - Descrizione: classi POCO con i campi del contratto di design (`Anno`, `Mese`, `TotaleVendite`, `RicavoTracciato`, `RicavoNonTracciato`, `SpeseTracciate`, `SpeseNonTracciate`, `IncassoContanteTracciato`, `IncassiElettronici`, `IncassiFattura`, `Registri`, `Chiusi`, `Bozze`) + metodo statico `RiepilogoAnnualeCassa.CompletaDodiciMesi(anno, aggregati)` che garantisce 12 elementi ordinati 1–12 con zeri per i mesi mancanti.
  - Criteri: `dotnet build` verde; `CompletaDodiciMesi` restituisce sempre esattamente 12 elementi ordinati.
  - Ref: spec `gestione-cassa` → "Query aggregata riepilogoAnnuale" (scenario "Anno con dati parziali", "Anno senza alcun registro").

- [x] **1.2 Creare i GraphQL type `RiepilogoMeseCassaType` e `RiepilogoAnnualeCassaType`**
  - File: `backend/GraphQL/GestioneCassa/Types/RiepilogoAnnualeCassaType.cs` (nuovo)
  - Descrizione: `ObjectGraphType<RiepilogoMeseCassa>` e `ObjectGraphType<RiepilogoAnnualeCassa>` con tutti i campi non-null (Decimal/Int), pattern dei type esistenti (`RegistroCassaType.cs`); registrazione nel DI se il progetto la richiede (verificare come sono registrati gli altri type).
  - Criteri: `dotnet build` verde; schema GraphQL espone i due tipi.
  - Ref: spec `gestione-cassa` → schema additivo (adattato ai nuovi tipi come da correzione vincolante 2).

- [x] **1.3 Aggiungere il field `riepilogoAnnuale(anno: Int!)` a `GestioneCassaQueries`**
  - File: `backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs`
  - Descrizione: resolver come da snippet di design — `GraphQLService.GetService<AppDbContext>(context)`, `Where(r => r.Data.Year == anno).GroupBy(r => r.Data.Month)` + `Sum`/`Count` traducibili in SQL (NIENTE `ToListAsync` dei registri grezzi), nessun filtro su `Stato` (bozze incluse nei totali), contatori `Registri`/`Chiusi` (CLOSED|RECONCILED)/`Bozze` (DRAFT), completamento a 12 mesi in memoria. `.Authorize()` ereditato dalla classe (verificare che il field risulti protetto).
  - Criteri: query eseguibile da GraphQL playground; per un anno vuoto restituisce 12 mesi a zero senza errori; senza JWT restituisce `ACCESS_DENIED`.
  - Ref: spec `gestione-cassa` → "Query aggregata riepilogoAnnuale" (tutti gli scenari); design → Decision "query server completamente nuova" e "formule identiche alla vista mensile, DRAFT inclusi, aggregazione SQL".

- [x] **1.4 Test di integrazione xUnit per `riepilogoAnnuale`**
  - File: `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementQueriesTests.cs` (estensione, pattern esistente)
  - Descrizione: seed di dataset misto (registri CLOSED, RECONCILED e DRAFT, campi a zero/limite, incassi in tutte le categorie, mesi mancanti) e test per: (a) 12 elementi sempre presenti e ordinati; (b) parità al centesimo tra aggregato e somma per-registro delle formule normative; (c) DRAFT inclusi nei totali e contati in `bozze`; (d) anno vuoto → 12 mesi a zero, nessun errore; (e) richiesta non autenticata → `ACCESS_DENIED`.
  - Criteri: `dotnet test` verde; ogni scenario della delta spec coperto da almeno un test.
  - Ref: spec `gestione-cassa` → "Test di coerenza aggregato server vs somma registri" + scenari di "Query aggregata riepilogoAnnuale".

## Fase 2 — Frontend data layer: formule condivise, query, hook + test Vitest

> Dipendenze: nessuna sul codice di Fase 1 (il fallback adapter copre il backend assente); lo schema/contratto di Fase 1 è però il riferimento.
> Batch: 1 sub-agent (2.1 → 2.7; 2.1-2.2 prima di 2.5-2.6).

- [x] **2.1 Tipi TS `RiepilogoMeseDashboard` e `RiepilogoDashboard`**
  - File: `duedgusto/src/@types/RegistroCassa.d.ts`
  - Descrizione: aggiungere i tipi del contratto dati di design (12 mesi, `totaliAnno`, `meseCorrente`, `fonte: "server" | "adapter"`, derivati `totaleSpese`/`differenza`). Non toccare i tipi esistenti.
  - Criteri: `npm run ts:check` verde.
  - Ref: spec `dashboard-cassa` → "Origine dati aggregata e contratto RiepilogoDashboard".

- [x] **2.2 Modulo formule pure `aggregaRegistri.tsx`**
  - File: `duedgusto/src/common/registroCassa/aggregaRegistri.tsx` (nuovo)
  - Descrizione: funzioni pure `aggregaRegistriPerMese(registri, anno)` e `derivaTotali(mesi)` con le STESSE formule di `VistaMensile.tsx` (movimento fisico, fallback `totaleVendite`, tracciato/non tracciato, null → 0), output shape `RiepilogoMeseDashboard[]` sempre a 12 mesi. Unico posto client dove vivono le formule.
  - Criteri: nessun `NaN` con input null/undefined; iterazione funzionale; nessuna dipendenza da React.
  - Ref: spec `dashboard-cassa` → "Definizioni e Formule (normative)" + scenario "Registro con campi null"; design → Decision "contratto dati + modulo formule condiviso".

- [x] **2.3 Test Vitest di parità formule**
  - File: `duedgusto/src/common/registroCassa/__tests__/aggregaRegistri.test.tsx` (nuovo, + fixture in `__tests__/fixtures`)
  - Descrizione: fixture condivise che replicano i casi della vista mensile (DRAFT inclusi, valori null, ricavo non tracciato negativo, mesi mancanti); asserzioni di parità al centesimo con i valori attesi calcolati a mano dalle formule normative; verifica 12 mesi sempre presenti.
  - Criteri: `npm run test` verde sui nuovi test.
  - Ref: spec `dashboard-cassa` → scenari "Coerenza al centesimo", "Registro con campi null", "Anno parziale".

- [x] **2.4 Query GraphQL `getRiepilogoAnnuale` + deprecazioni**
  - File: `duedgusto/src/graphql/registroCassa/queries.tsx`
  - Descrizione: aggiungere il `TypedDocumentNode` `getRiepilogoAnnuale` (shape di design: `gestioneCassa { riepilogoAnnuale(anno) { anno mesi { ... } } }`); annotare `@deprecated` (solo commento JSDoc) `getRiepilogoMensile` (field server inesistente, codice morto) e `getDashboardKPIs` (hook mai usato). NON rimuoverle.
  - Criteri: `npm run ts:check` e `npm run lint` verdi; nessun consumer esistente rotto.
  - Ref: design → File Changes `queries.tsx`; proposal Out of Scope (cleanup separato).

- [x] **2.5 Hook `useQueryRiepilogoAnnuale`**
  - File: `duedgusto/src/graphql/registroCassa/useQueryRiepilogoAnnuale.tsx` (nuovo)
  - Descrizione: `useQuery(getRiepilogoAnnuale, { fetchPolicy: "cache-and-network", notifyOnNetworkStatusChange: true })`; normalizzazione a 12 mesi garantiti; espone `data/loading/error/refetch`. Rilevamento dell'errore di validazione schema (`GRAPHQL_VALIDATION_FAILED` / `Cannot query field "riepilogoAnnuale"`) esposto come flag per l'adapter.
  - Criteri: `ts:check` verde; pattern identico a `useQueryCashRegistersByMonth.tsx` (fix `33896a4`).
  - Ref: spec `dashboard-cassa` → "Origine dati aggregata" (scenario "Fonte primaria server"); design → Decision "cache-and-network".

- [x] **2.6 Hook `useDashboardData` (contratto unico + adapter fallback + subscription)**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/useDashboardData.tsx` (nuovo)
  - Descrizione: orchestrazione dati come da Data Flow di design — (1) query server; (2) su errore di validazione attiva l'adapter (`getRegistriCassa` dell'anno con `skip` altrimenti + `aggregaRegistriPerMese`), `fonte: "adapter"`, `logger.warn` diagnostico, commento `// TEMPORANEO: rimuovere quando riepilogoAnnuale è deployato`; (3) `useRegistroCassaSubscription` con `useRef` sull'evento precedente (pattern `VistaMensile.tsx` 66-73) e `refetch()` SOLO se `anno(evento.data) === annoSelezionato`; (4) derivati (`totaliAnno`, `meseCorrente`, mese di riferimento per anni passati = ultimo mese con registri) via catena `useMemo` + costante modulo `EMPTY_MESI`.
  - Criteri: `ts:check` verde; nessun loop di render (react-best-practices §3/§12); l'adapter NON è eseguito quando il server risponde.
  - Ref: spec `dashboard-cassa` → "Origine dati aggregata" (scenario "Fallback adapter client"), "KPI gestionali del mese di riferimento" (mese di riferimento), "Selezione anno".

- [x] **2.7 Test Vitest degli hook dati**
  - File: `duedgusto/src/graphql/registroCassa/__tests__/useQueryRiepilogoAnnuale.test.tsx` (nuovo; test di `useDashboardData` adiacente in `dashboard/__tests__/`)
  - Descrizione: con `MockedProvider` + `renderHook`: (a) dati server → `fonte: "server"`; (b) errore di validazione → adapter attivo e stessa shape/valori delle formule normative; (c) evento subscription con anno corrispondente → `refetch` chiamato; (d) evento con anno diverso → NESSUN refetch; (e) mese di riferimento corretto per anno passato.
  - Criteri: `npm run test` verde.
  - Ref: spec `dashboard-cassa` → scenari "Fonte primaria server", "Fallback adapter client", "Cambio anno"; design → Testing Strategy Unit FE.

## Fase 3 — Componenti UI: palette, KPI, donut, trend

> Dipendenze: Fase 2 (tipi + contratto `RiepilogoDashboard`). Installazione libreria in 3.1 prima di tutto il resto.
> Batch: 1 sub-agent. OBBLIGO: invocare `interface-design` e `react-best-practices` prima di scrivere i componenti.

- [x] **3.1 Installare `@mui/x-charts@^8`**
  - File: `duedgusto/package.json`
  - Descrizione: `npm install @mui/x-charts@^8` (ultima 8.x). NON la ^9 (peer dep `@mui/material ^7.3+` incompatibile con 6.4.8). Recharts resta invariato.
  - Criteri: install senza warning di peer deps; `npm run build` verde.
  - Ref: design → Decision "@mui/x-charts@^8 (NON ^9)".

- [x] **3.2 Hook `useChartPalette`**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/useChartPalette.tsx` (nuovo)
  - Descrizione: palette centralizzata da `useTheme()` come da snippet di design (vendite/tracciato/nonTracciato/elettronici/fatture/spese/netto + `linkAlpha` + `tooltip`), memoizzata su `theme`. Unica fonte colore per x-charts E Recharts: nessun hex hardcodato nei componenti.
  - Criteri: cambio tema dark/light a runtime aggiorna i colori senza reload; `ts:check` verde.
  - Ref: spec `dashboard-cassa` → "Tema dark/light" (scenario "Cambio tema a runtime").

- [x] **3.3 Evoluzione retro-compatibile di `common/KPICard.tsx`**
  - File: `duedgusto/src/components/common/KPICard.tsx`
  - Descrizione: prop opzionali `variant?: "compact" | "hero"`, `trend?: number`, `sparklineData?: number[]`, `subtitle?: string`, `color?: string` con default = comportamento attuale (i 9 utilizzi esistenti, es. `RiepilogoCards.tsx`, NON devono cambiare resa). Sparkline `SparkLineChart` x-charts (~40px, area, colore tema) solo in `variant="hero"`; sparkline omessa se la serie ha < 2 mesi con dati; indicatore trend % omesso se `trend` undefined.
  - Criteri: snapshot/render esistenti invariati per la variant di default; `ts:check` + `lint` verdi.
  - Ref: spec `dashboard-cassa` → "Sparkline nelle KPI card" (entrambi gli scenari), "Confronto con il periodo precedente"; design → Decision "evoluzione retro-compatibile KPICard".

- [x] **3.4 `DashboardHeader.tsx`**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/DashboardHeader.tsx` (nuovo)
  - Descrizione: titolo "Dashboard Cassa", `Select` anno (default anno corrente, almeno ultimi 5 anni), azioni Nuova Cassa / Lista / Vista Mensile con `useCallback`; header `flexShrink: 0` con `borderBottom` divider (react-best-practices §1).
  - Criteri: cambio anno propaga al parent via prop `onAnnoChange`; header visibile e interattivo anche durante il loading.
  - Ref: spec `dashboard-cassa` → "Selezione anno", "Stati di caricamento".

- [x] **3.5 `HeroKpiSection.tsx` (hero Differenza + banda KPI densa)**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/HeroKpiSection.tsx` (nuovo)
  - Descrizione: layout di design — Differenza come unico numero grande (`h3`, `primary.main` se ≥ 0 altrimenti `error.main`, sparkline 12 mesi, trend % vs mese precedente con formula `(cur − prev) / |prev| × 100`, omesso se prev è 0/assente); banda densa con gli altri 6 KPI (colori semantici di `RiepilogoIncassiMensile`: vendite `primary`, spese `error` con prefisso −, tracciato `success`, non tracciato `warning`); chip `N registri`/`N bozze`; intestazione con mese/anno di riferimento espliciti; `fontVariantNumeric: "tabular-nums"`, formattazione via `formatCurrency` (bones); KPI annuali compatti (vendite, spese, differenza, tracciato, non tracciato).
  - Criteri: i 7 KPI del mese di riferimento coincidono al centesimo con `RiepilogoIncassiMensile` a parità di dati mock; nessun "Infinity%"/`NaN`; skeleton al primo caricamento.
  - Ref: spec `dashboard-cassa` → "KPI gestionali del mese di riferimento" (tutti gli scenari), "KPI annuali", "Confronto con il periodo precedente", "Stati di caricamento".

- [x] **3.6 `DonutDistribuzioneIncassi.tsx`**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/DonutDistribuzioneIncassi.tsx` (nuovo)
  - Descrizione: `PieChart` x-charts, 4 fette (contante tracciato/elettronici/fatture/non tracciato) con colori da `useChartPalette`, `innerRadius` ~60%, centro con totale vendite anno, `valueFormatter` → `formatCurrency` + percentuale; segmenti ≤ 0 esclusi dal grafico ma presenti in legenda a zero; clamp a 0 dei negativi con nota nel tooltip; empty state; legenda a destra su desktop, sotto su mobile.
  - Criteri: somma fette = ricavo tracciato + max(non tracciato, 0); nessun segmento negativo renderizzato; leggibile dark/light.
  - Ref: spec `dashboard-cassa` → "Donut distribuzione incassi" (entrambi gli scenari), "Tema dark/light".

- [x] **3.7 `TrendMensile.tsx` (barre + linea)**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/TrendMensile.tsx` (nuovo)
  - Descrizione: `BarChart` x-charts Vendite vs Spese sui 12 mesi (asse X sempre completo Gen–Dic, mesi vuoti a 0) + serie linea Differenza (ambra) e linee Ricavo tracciato/non tracciato (composizione combinata o seconda vista nella stessa sezione, una sola sezione trend come da design); tooltip in euro; colori da `useChartPalette`.
  - Criteri: 12 punti per serie sempre; nessun buco d'asse con anno parziale; tooltip formattato `formatCurrency`.
  - Ref: spec `dashboard-cassa` → "Trend mensile ricavi vs spese (barre)" (scenario "Anno parziale"), "Andamento (linea)" (scenario "Andamento tracciato vs non tracciato").

- [x] **3.8 Test Vitest dei componenti UI**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/__tests__/HeroKpiSection.test.tsx`, `DonutDistribuzioneIncassi.test.tsx`, `TrendMensile.test.tsx` (nuovi) + eventuale aggiornamento test `KPICard`
  - Descrizione: render con mock `RiepilogoDashboard`: valori formattati corretti, trend % omesso con prev = 0, sparkline omessa con < 2 mesi, clamp negativi nel donut, 12 mesi nel trend, empty state, retro-compatibilità `KPICard` compact.
  - Criteri: `npm run test` verde.
  - Ref: design → Testing Strategy Unit FE; scenari spec citati nei task 3.3, 3.5–3.7.

## Fase 4 — Sankey lazy + error boundary + fallback

> Dipendenze: Fase 2 (contratto dati), 3.1 (x-charts per il fallback), 3.2 (palette).
> Batch: 1 sub-agent.

- [x] **4.1 `SankeyFlussoCassa.tsx` (Recharts, export default per lazy)**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/SankeyFlussoCassa.tsx` (nuovo)
  - Descrizione: Sankey Recharts con la topologia di design (Vendite → Tracciato/Non tracciato → Spese tracciate/non tracciate → Netto); valori clampati a ≥ 0 con conservazione del flusso (residui; se una spesa eccede il ramo, delta sottratto dal Netto); tooltip custom con `Paper` MUI (bg `background.paper`, bordo `divider`) e valori `formatCurrency`; colori nodi/link SOLO da `useChartPalette` (link con `linkAlpha`); indicazione testuale quando `differenza < 0` ("netto negativo" con valore reale); `export default` (richiesto da `React.lazy`). Unico file del progetto (fuori dal legacy) che importa `recharts`.
  - Criteri: nessun link con valore negativo; saldo negativo segnalato testualmente; dark/light coerenti; `ts:check` verde.
  - Ref: spec `dashboard-cassa` → "Sankey flusso di denaro" (scenari "Flusso completo positivo", "Netto negativo"), "Tema dark/light".

- [x] **4.2 `SankeyErrorBoundary.tsx`**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/SankeyErrorBoundary.tsx` (nuovo)
  - Descrizione: class component con `componentDidCatch` che logga via `logger` (non `console`) e renderizza la prop `fallback`; protegge dal crash recharts#6857 con React 19.
  - Criteri: quando il figlio lancia, il resto della dashboard resta funzionante e compare il fallback.
  - Ref: spec `dashboard-cassa` → "Sankey flusso di denaro" (scenario "Errore di rendering del Sankey"), "Gestione errori" (logger).

- [x] **4.3 `FlussoCassaBarreImpilate.tsx` (fallback x-charts)**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/FlussoCassaBarreImpilate.tsx` (nuovo)
  - Descrizione: `BarChart` x-charts impilato (tracciato/non tracciato/spese/netto) con la stessa semantica informativa del Sankey e colori da `useChartPalette`; usato come fallback dell'error boundary.
  - Criteri: renderizza gli stessi aggregati del Sankey; nessuna dipendenza da Recharts.
  - Ref: design → Decision "ibrido x-charts + Recharts confinato al solo Sankey".

- [x] **4.4 Test Vitest del blocco Sankey**
  - File: `duedgusto/src/components/pages/registrazioneCassa/dashboard/__tests__/SankeyFlussoCassa.test.tsx`, `SankeyErrorBoundary.test.tsx` (nuovi)
  - Descrizione: (a) costruzione nodi/link: clamp a 0, conservazione flusso, caso netto negativo con nota testuale (testare la funzione di trasformazione dati, non il render Recharts pixel-perfect); (b) error boundary: figlio che lancia → fallback montato + `logger` chiamato, resto dell'albero intatto.
  - Criteri: `npm run test` verde.
  - Ref: spec `dashboard-cassa` → scenari "Netto negativo", "Errore di rendering del Sankey".

## Fase 5 — Integrazione, cache/subscription, cleanup, verifiche finali

> Dipendenze: Fasi 1–4 complete.
> Batch: 1 sub-agent. OBBLIGO: `interface-design` per la rifinitura visiva; richiedere l'approvazione visiva dell'utente (Open Question del design) prima di chiudere.

- [x] **5.1 Riscrittura orchestratore `RegistrazioneCassDashboard.tsx`**
  - File: `duedgusto/src/components/pages/registrazioneCassa/RegistrazioneCassDashboard.tsx`
  - Descrizione: da monolite 524 righe a orchestratore ~100 righe: stato `selectedYear`, `useDashboardData`, layout react-best-practices §1 (flex column, `height: calc(100vh - 64px)`, scroll singolo, `minHeight: 0`), griglia Tailwind `grid-cols-12` (hero col-12, Sankey lg:col-8 + donut lg:col-4, trend col-12), `Paper variant="outlined"` ovunque (borders-only); Sankey via `React.lazy` dentro `SankeyErrorBoundary` + `Suspense` con `Skeleton` (snippet di design); eliminazione della `KPICard` locale duplicata e dell'uso di `useQueryYearlySummary`; stati loading (skeleton per sezione + `LinearProgress` in rivalidazione), error (`Alert` + Riprova → `refetch`), empty (anno senza registri → empty state unico con CTA "Nuova Cassa"); responsive da 360px senza scroll orizzontale.
  - Criteri: nessuna query `GetRegistriCassa` con pageSize ≥ 100 dalla dashboard (verificare network in dev); `HomePage.tsx` invariato e funzionante; tutti gli stati loading/empty/error come da tabella di design.
  - Ref: spec `dashboard-cassa` → "Origine dati aggregata" (MUST NOT liste larghe), "Stati di caricamento", "Empty state", "Gestione errori", "Layout responsive", "Selezione anno".

- [x] **5.2 `typePolicies` Apollo per i riepiloghi**
  - File: `duedgusto/src/graphql/configureClient.tsx`
  - Descrizione: aggiungere `RiepilogoAnnualeCassa: { keyFields: ["anno"] }` e `RiepilogoMeseCassa: { keyFields: ["anno", "mese"] }` alle `typePolicies` esistenti.
  - Criteri: cambio anno e refetch normalizzano in cache senza duplicati; nessuna regressione sulle altre typePolicies.
  - Ref: design → Decision "cache-and-network + refetch mirato via subscription".

- [x] **5.3 Annotazioni `@deprecated` sul codice morto (nessuna rimozione)**
  - File: `duedgusto/src/graphql/registroCassa/useQueryYearlySummary.tsx`, `useQueryDashboardKPIs.tsx` (+ verifica commenti già messi in 2.4 su `queries.tsx`)
  - Descrizione: JSDoc `@deprecated` con motivazione e puntatore a `useQueryRiepilogoAnnuale`; NESSUNA rimozione (cleanup fuori scope come da proposal). Verificare con grep che `useQueryYearlySummary` non abbia più consumer.
  - Criteri: `lint` verde; nessun consumer residuo di `useQueryYearlySummary`.
  - Ref: proposal → Out of Scope; design → File Changes nota finale.

- [x] **5.4 Verifica bundle: Recharts in chunk separato**
  - File: output di `npm run build` (nessun file sorgente)
  - Descrizione: eseguire `npm run build` e verificare che `recharts` finisca nel chunk lazy di `SankeyFlussoCassa` e non nel bundle principale; grep che nessun file della nuova dashboard (oltre a `SankeyFlussoCassa.tsx`) importi `recharts`.
  - Criteri: chunk separato visibile nell'output di build; import `recharts` solo in `SankeyFlussoCassa.tsx` (e nel legacy preesistente fuori scope).
  - Ref: spec `dashboard-cassa` → "Sankey flusso di denaro" (MUST lazy); design → Lazy loading / code splitting.

- [x] **5.5 Smoke test E2E + visual regression**
  - File: nuovi/aggiornati spec Playwright in `duedgusto` (cartelle E2E/visual esistenti, seguire il pattern del progetto)
  - Descrizione: E2E smoke — dashboard carica senza errori console (guardia recharts#6857), donut/Sankey (o fallback)/trend visibili, cambio anno aggiorna i valori; visual — screenshot dashboard in dark e light (nuovi snapshot).
  - Criteri: `npm run test:e2e` e `npm run test:visual` verdi in locale.
  - Ref: spec `dashboard-cassa` → scenari "Cambio anno", "Cambio tema a runtime", "Errore di rendering del Sankey"; design → Testing Strategy E2E/Visual.

- [x] **5.6 Gate finale di qualità**
  - File: nessuno (verifiche)
  - Descrizione: eseguire in sequenza `npm run ts:check`, `npm run lint`, `npm run test`, `npm run build` (frontend) e `dotnet build`, `dotnet test` (backend); risolvere ogni rosso prima di dichiarare la fase completa.
  - Criteri: tutti i comandi verdi; success criteria del proposal spuntabili (KPI al centesimo, niente download 1000 registri, KPICard unica, nessun crash Sankey).
  - Ref: proposal → Success Criteria; config → rules.verify.

- [x] **5.7 Approvazione visiva dell'utente** — approvata esplicitamente dall'utente il 2026-07-04 ("ok vai con sdd-verify poi commit + push")
  - File: nessuno (review)
  - Descrizione: presentare all'utente la dashboard renderizzata (dark + light) e ottenere conferma esplicita del layout "Differenza hero + banda KPI densa" (Open Question del design). In caso di feedback, iterare sulla Fase 3/5 prima della verify.
  - Criteri: approvazione esplicita registrata (nota nel change / engram).
  - Ref: proposal → Success Criteria ("Approvazione visiva esplicita"); design → Open Questions.

---

## Riepilogo dipendenze tra fasi

```
Fase 1 (backend) ────────────┐
                             ├──> Fase 5 (integrazione + verifiche)
Fase 2 (data layer FE) ──┬───┤
                         ├──> Fase 3 (UI) ──> Fase 4 (Sankey) ──┘
                         └────────────────────^ (4 usa contratto di 2 e palette/x-charts di 3.1-3.2)
```

- Fase 1 e Fase 2 parallelizzabili (l'adapter disaccoppia il frontend dal deploy backend).
- Fase 3 richiede Fase 2 (contratto dati) e inizia con 3.1 (install x-charts).
- Fase 4 richiede 2 (dati), 3.1 (fallback x-charts) e 3.2 (palette).
- Fase 5 chiude: integrazione, cache, cleanup, build/test/E2E, approvazione utente.
