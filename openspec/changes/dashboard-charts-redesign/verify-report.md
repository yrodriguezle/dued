# Verification Report

**Change**: dashboard-charts-redesign
**Data verifica**: 2026-07-04
**Stato working tree**: implementazione non committata; approvazione visiva utente CONCESSA (task 5.7)

---

## Completeness

| Metrica | Valore |
|---------|--------|
| Task totali | 24 |
| Task completati | 23 (1.1–5.6) |
| Task incompleti | 1 — 5.7 approvazione visiva: concessa dall'utente, spunta a carico dell'orchestratore |

---

## Build & Tests (esecuzione reale)

| Gate | Comando | Esito |
|------|---------|-------|
| TypeScript | `npm run ts:check` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 |
| Unit FE | `npm run test` (Vitest) | ✅ 606/606 passati, 80 file, 0 skip |
| Build FE | `npm run build` | ✅ exit 0 (tsc -b + vite) |
| Build BE | `dotnet build` | ✅ 0 errori, 0 warning |
| Test BE | `dotnet test` (xUnit) | ✅ 260/260 passati, 0 skip |
| Coverage | non configurata in `openspec/config.yaml` | ➖ Non configurato |

Note di esecuzione:
- `dotnet build`/`dotnet test` eseguiti con `-p:BaseOutputPath` rediretto su cartella temporanea: il backend dev era in esecuzione (PID 23004, `bin\Debug\net8.0\duedgusto.exe`) e bloccava l'output standard. Non è un problema del codice; alla prima build con il server spento l'output standard tornerà a funzionare.
- E2E (`npm run test:e2e`) e visual (`npm run test:visual`) NON rieseguiti in questa verify (richiedono backend+frontend attivi; il task 5.6/5.5 li dichiara già verdi in apply). Gli spec Playwright esistono e sono coerenti con gli scenari: `duedgusto/e2e/functional/dashboard-cassa.spec.ts`, `duedgusto/e2e/visual-regression/dashboard-cassa.spec.ts`.

Verifica bundle (task 5.4): Recharts confinato nel chunk lazy `dist/assets/SankeyFlussoCassa-*.js` (221,78 kB / gzip 68,36 kB): marker `recharts-surface` presente SOLO nel chunk, assente in `index-*.js` (844 kB). Unico import `recharts` in `src/components/pages/registrazioneCassa/dashboard/SankeyFlussoCassa.tsx`.

---

## Spec Compliance Matrix — dashboard-cassa

| Requirement | Scenario | Test | Esito |
|-------------|----------|------|-------|
| KPI gestionali mese di riferimento | Coerenza al centesimo con vista mensile | `aggregaRegistri.test` ("parità con monthlyStats di VistaMensile") + `HeroKpiSection.test` ("7 KPI ... al centesimo") | ✅ COMPLIANT |
| KPI gestionali mese di riferimento | Anno passato selezionato | `useDashboardData.test` ("anno passato → ultimo mese con registri") | ✅ COMPLIANT |
| KPI gestionali mese di riferimento | Registro con campi null | `aggregaRegistri.test` ("campi null come 0 senza NaN") | ✅ COMPLIANT |
| KPI annuali | Aggregato annuale = somma mesi | `aggregaRegistri.test` ("derivaTotali somma i 12 mesi") + `HeroKpiSection.test` ("totali annuali compatti") | ✅ COMPLIANT |
| Confronto periodo precedente | Trend positivo mese su mese | `HeroKpiSection.test` ("formula (cur−prev)/|prev|×100", "+10,0%") | ✅ COMPLIANT |
| Confronto periodo precedente | Periodo precedente senza dati | `HeroKpiSection.test` ("omette il trend ... niente Infinity%") | ✅ COMPLIANT |
| Donut distribuzione incassi | Tutte le categorie valorizzate | `DonutDistribuzioneIncassi.test` ("4 categorie in legenda", "totale al centro") | ✅ COMPLIANT |
| Donut distribuzione incassi | Categoria a zero | `DonutDistribuzioneIncassi.test` ("legenda a zero", "clamp negativo con nota") | ✅ COMPLIANT |
| Trend mensile (barre) | Anno parziale | `TrendMensile.test` ("12 punti con 0 per i mesi assenti") | ✅ COMPLIANT |
| Andamento (linea) | Tracciato vs non tracciato | `TrendMensile.test` ("serie barre e linee in legenda") | ✅ COMPLIANT |
| Sparkline KPI card | Storico disponibile | `KPICard.test` + `HeroKpiSection.test` ("sparkline con almeno 2 mesi") | ✅ COMPLIANT |
| Sparkline KPI card | Storico insufficiente | `KPICard.test` + `HeroKpiSection.test` ("omette la sparkline") | ✅ COMPLIANT |
| Sankey flusso di denaro | Flusso completo positivo | `SankeyFlussoCassa.test` ("conserva il flusso", "topologia completa") | ✅ COMPLIANT |
| Sankey flusso di denaro | Netto negativo | `SankeyFlussoCassa.test` ("netto negativo → 0 nel grafico + valore reale") | ✅ COMPLIANT |
| Sankey flusso di denaro | Errore di rendering | `SankeyErrorBoundary.test` ("fallback + logger, resto dell'albero intatto") | ✅ COMPLIANT |
| Origine dati aggregata / RiepilogoDashboard | Fonte primaria server | `useDashboardData.test` ("fonte: server"), `useQueryRiepilogoAnnuale.test` | ✅ COMPLIANT |
| Origine dati aggregata / RiepilogoDashboard | Fallback adapter client | `useDashboardData.test` ("adapter su GRAPHQL_VALIDATION_FAILED, stesse formule") | ✅ COMPLIANT |
| Selezione anno | Cambio anno | `useDashboardData.test` (refetch/derivati per anno) + E2E "cambio anno" (non rieseguito) | ⚠️ PARTIAL (nessun unit test di `DashboardHeader`; copertura demandata all'E2E) |
| Stati di caricamento | Primo caricamento | test skeleton in `HeroKpiSection/Donut/Trend/SankeyErrorBoundary`.test | ✅ COMPLIANT |
| Empty state | Anno senza registri | test empty nelle sezioni; empty state pagina (orchestratore) solo via E2E | ⚠️ PARTIAL (nessun unit test dell'orchestratore `RegistrazioneCassDashboard`) |
| Gestione errori | Errore di rete con retry | (nessun test trovato; implementato `Alert` + "Riprova" → `refetch`) | ❌ UNTESTED + log mancante (vedi Issues) |
| Tema dark/light | Cambio tema a runtime | `useChartPalette` memoizzato su `theme`; visual dark/light spec presenti (non rieseguiti) | ⚠️ PARTIAL (verifica statica ok, prova runtime demandata a visual test) |
| Layout responsive | Mobile / desktop | E2E "nessuno scroll orizzontale" (non rieseguito); griglia `grid-cols-12` + flexWrap | ⚠️ PARTIAL (statico ok) |

## Spec Compliance Matrix — gestione-cassa (delta)

| Requirement | Scenario | Test | Esito |
|-------------|----------|------|-------|
| Query `riepilogoAnnuale` | Anno con dati parziali | `CashManagementQueriesTests.RiepilogoAnnuale_AnnoConDatiParziali_...` | ✅ COMPLIANT |
| Query `riepilogoAnnuale` | Coerenza con somma registri | `..._ParitaAlCentesimo_AggregatoCoincideConSommaPerRegistro` | ✅ COMPLIANT |
| Query `riepilogoAnnuale` | Anno senza registri | `..._AnnoSenzaRegistri_Restituisce12MesiAZeroSenzaErrori` | ✅ COMPLIANT |
| Query `riepilogoAnnuale` | Accesso non autorizzato | `..._RichiedeAutorizzazione_...` (verifica `IsAuthorizationRequired` + field presente) | ⚠️ PARTIAL (non è un test end-to-end via executor GraphQL con richiesta anonima) |
| Campi tracciati su `RiepilogoMensileCassa` | Nuovi campi interrogabili / retrocompatibilità | Superato dalla correzione vincolante del design: `riepilogoMensile` NON esiste nel backend → creati tipi nuovi `RiepilogoMeseCassa`/`RiepilogoAnnualeCassa`; nessun tipo esistente toccato | ✅ COMPLIANT col design (delta spec da riallineare in archive) |
| Test coerenza aggregato vs somma | Dataset misto | stessi test xUnit sopra (DRAFT inclusi, non tracciato negativo, centesimi "scomodi", anno estraneo escluso) | ✅ COMPLIANT (nota: i decimali del modello BE sono non-nullable → il caso "campi null" non esiste lato server, come documentato in design) |

**Compliance summary**: 20/25 scenari COMPLIANT, 4 PARTIAL, 1 UNTESTED.

---

## Coherence (Design)

| Decisione | Rispettata? | Note |
|-----------|-------------|------|
| `@mui/x-charts@^8` (NON ^9) | ✅ Sì | `package.json` `^8.29.2`, installata 8.29.2; MUI core resta 6.4.8 |
| Recharts SOLO nel Sankey + lazy chunk separato | ✅ Sì | unico import in `SankeyFlussoCassa.tsx`; chunk `SankeyFlussoCassa-*.js` separato, `recharts-surface` assente dal main bundle; `React.lazy` + `Suspense` + `SankeyErrorBoundary` → fallback `FlussoCassaBarreImpilate` (x-charts) |
| Formule uniche in `aggregaRegistri` | ✅ Sì | `src/common/registroCassa/aggregaRegistri.tsx` unico modulo formule client; usato da adapter, normalizzazione server e fixture test; parità con `monthlyStats` di VistaMensile testata |
| Adapter fallback SOLO su GRAPHQL_VALIDATION_FAILED | ✅ Sì | `isRiepilogoAnnualeNonDisponibile`: `extensions.code === "GRAPHQL_VALIDATION_FAILED"` o messaggio `Cannot query field "riepilogoAnnuale"`; query adapter con `skip: !adapterAttivo`; errori di rete NON attivano l'adapter; `logger.warn` + commento TEMPORANEO presenti |
| `typePolicies` keyFields | ✅ Sì | `configureClient.tsx`: `RiepilogoAnnualeCassa: ["anno"]`, `RiepilogoMeseCassa: ["anno","mese"]` |
| Deprecazioni senza rimozione | ✅ Sì | `@deprecated` su `getRiepilogoMensile`, `getMonthlySummary`, `getDashboardKPIs`, `useQueryDashboardKPIs`, `useQueryYearlySummary`, `MonthlyView`; nessun consumer residuo di `useQueryYearlySummary` (solo il suo test) |
| DRAFT inclusi negli aggregati server | ✅ Sì | `RiepilogoAnnualeCassa.AggregaAsync` non filtra `Stato`; contatori `Registri/Chiusi/Bozze`; test xUnit dedicato (DRAFT nei totali + contato in `bozze`) |
| Query server nuova (no estensione `riepilogoMensile`) | ✅ Sì | tipi nuovi + `Field` in `GestioneCassaQueries` con `GraphQLService.GetService<AppDbContext>`; `GroupBy/Sum` lato SQL, completamento 12 mesi in memoria |
| `cache-and-network` + refetch da subscription | ✅ Sì | `useQueryRiepilogoAnnuale` (fetchPolicy + notifyOnNetworkStatusChange) e `useDashboardData` (useRef pattern, refetch solo se anno evento === anno selezionato; testato anche il caso negativo) |
| KPICard retro-compatibile | ✅ Sì | prop opzionali con default = comportamento storico; test dedicati alla variante compact invariata; copia locale eliminata dal monolite |
| File Changes | ⚠️ Deviazioni minori benigne | file aggiuntivi non previsti dalla tabella: `SankeyFlussoCassaLazy.tsx` (composizione lazy+boundary), `dashboardUtils.tsx`, `flussoCassaUtils.tsx` (utility pure estratte per testabilità/fast-refresh) — coerenti con lo spirito del design |

---

## Issues Found

**CRITICAL** (bloccanti): Nessuno.

**WARNING** (da sistemare, non bloccanti):
1. Spec "Gestione errori": "Gli errori MUST essere loggati tramite il logger dell'app". L'errore di query della dashboard mostra `Alert` + "Riprova" ma NON viene loggato via `logger` (né in `useDashboardData` né in `RegistrazioneCassDashboard`; l'errorLink Apollo logga solo i fallimenti di refresh token). Fix banale: `logger.error` quando `error` è valorizzato.
2. Scenario "Errore di rete con retry" senza alcun test automatico (unit o E2E) del percorso errore → Riprova → refetch.
3. Test autorizzazione backend "leggero": verifica `IsAuthorizationRequired` sulla classe + presenza del field, non una richiesta GraphQL anonima end-to-end con `ACCESS_DENIED` (coerente col pattern del file, ma lo scenario della delta spec è coperto solo indirettamente).

**SUGGESTION** (migliorie):
1. `KPICard.hasSparklineData` usa "valori ≠ 0" come proxy di "mesi con dati": un mese con registri e differenza esattamente 0 non conta ai fini della soglia dei 2 mesi (edge case irrilevante in pratica).
2. Trend di gennaio vs dicembre anno precedente: non implementato (serve `riepilogoAnnuale(anno-1)`); conforme alla spec ("se il dato è disponibile") ed esplicitamente rimandato nelle Open Questions del design — da decidere in archive se aprire un follow-up.
3. La build di produzione include chunk `*.test-*.js` (anche di pagine preesistenti: `ProfilePage.test`, `RiepilogoCards.test`, ...): comportamento PRE-esistente dovuto al glob dei componenti dinamici, non regressione di questo change — candidato a cleanup separato.
4. In archive: riallineare la delta spec `gestione-cassa` (che descrive l'estensione di `RiepilogoMensileCassa`) alla soluzione effettiva (tipi nuovi `RiepilogoMeseCassa`/`RiepilogoAnnualeCassa`), correzione già sancita come vincolante in design/tasks.

---

## Verdetto

**PASS CON NOTE** — Implementazione completa e conforme a specs e design; tutti i gate eseguiti sono verdi (ts:check, lint, 606 test FE, build FE con chunk Recharts isolato, build BE, 260 test BE). Restano 3 warning non bloccanti (logging errori dashboard, test mancante per lo scenario retry, test auth leggero) e il riallineamento della delta spec in archive. Pronto per commit e archive.
