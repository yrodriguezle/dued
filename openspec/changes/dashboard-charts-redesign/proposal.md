# Proposal: Redesign Dashboard con Grafici (dashboard-charts-redesign)

## Intent

La dashboard attuale (`RegistrazioneCassDashboard.tsx`, 524 righe, monolitica) non soddisfa l'utente né visivamente né funzionalmente:

1. **KPI obsoleti**: mostra 8 KPI generici (4 mese + 4 anno) invece delle metriche gestionali che l'utente usa davvero nella vista mensile (`RiepilogoIncassiMensile.tsx`): ricavo tracciato/non tracciato, spese tracciate/non tracciate, differenza.
2. **Dati inefficienti**: aggrega client-side scaricando fino a 1000 registri via `useQueryYearlySummary` (connection Relay `GetRegistriCassa`), mentre esistono query server aggregate sottoutilizzate (`GetDashboardKPIs` — hook mai usato — e `GetRiepilogoMensile` — usata solo dal legacy `MonthlyView.tsx`).
3. **Debito UI**: `KPICard` duplicata localmente (esiste già `src/components/common/KPICard.tsx` riutilizzabile e inutilizzato qui), gerarchia visiva piatta, densità e coerenza col tema MUI (primary #ffab40, dark/light) insufficienti.
4. **Grafici mancanti**: l'utente vuole esplicitamente un grafico a torta/donut per la distribuzione e un flow chart (Sankey) del flusso di cassa (vendite → tracciato/non tracciato → spese → netto), oltre a trend line/bar sensati.

Obiettivo: ridisegnare la dashboard con gerarchia visiva chiara, KPI gestionali della vista mensile, e una strategia grafici ibrida `@mui/x-charts` + Recharts. **Non** è un semplice swap di libreria: il risultato deve essere visivamente migliore.

## Scope

**Moduli coinvolti**: frontend (principale) + backend (estensione query aggregate, sola lettura). **Nessuna migrazione database richiesta** (solo aggregazioni su campi già esistenti del `RegistroCassa`).

### In Scope

- **Nuova dipendenza**: `@mui/x-charts` v9.x (Community, MIT) come libreria grafici principale — donut/pie, bar, line/area, sparkline nelle KPI card, theming MUI automatico.
- **Recharts 3.6 mantenuto SOLO per il Sankey** del flusso di cassa (sankey/funnel in MUI X sono Pro a pagamento): vendite → ricavo tracciato/non tracciato → spese → netto.
- **Redesign completo e decomposizione** di `RegistrazioneCassDashboard.tsx` in sottocomponenti (sezione KPI, donut distribuzione incassi, Sankey flusso di cassa, trend mensile bar/line, header filtri) sotto `src/components/pages/registrazioneCassa/dashboard/`.
- **KPI ispirati alla vista mensile**: Totale Vendite, Totale Spese, Differenza, Ricavo tracciato (contante tracciato + elettronici + fatture), Ricavo non tracciato (movimento fisico − contante tracciato), Spese tracciate (`speseFornitori`), Spese non tracciate (`speseGiornaliere`) — con sparkline di trend dove sensato.
- **Riuso/evoluzione** di `src/components/common/KPICard.tsx` (eliminazione della copia locale duplicata).
- **Strategia dati server-side**: nuova query GraphQL `riepilogoAnnuale(anno)` in `backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs` che restituisce 12 riepiloghi mensili aggregati (totali vendite/spese, tracciato/non tracciato, breakdown incassi contanti/elettronici/fatture) + estensione di `RiepilogoMensileCassa` con i campi tracciati. Nuovo hook frontend `useQueryRiepilogoAnnuale`. La dashboard smette di scaricare 1000 registri.
- **Contratto dati disaccoppiato**: la UI consuma un tipo `RiepilogoDashboard` normalizzato; in caso di slittamento backend, un adapter client-side temporaneo (sui registri del mese via `useQueryCashRegistersByMonth`) mantiene la stessa shape.
- Aggiornamento test unitari (Vitest) dei nuovi componenti/hook e test integrazione backend (xUnit) per la nuova query.

### Out of Scope

- Rimozione/refactor del legacy `MonthlyView.tsx` e della query `GetDashboardKPIs` / hook `useQueryDashboardKPIs` inutilizzato (cleanup separato; qui al massimo si annota la deprecazione).
- Rimozione completa di Recharts dal progetto (resta per il Sankey).
- Modifiche alla vista mensile `RiepilogoIncassiMensile.tsx` (è il riferimento, non il target).
- Real-time push su tutta la dashboard: la subscription `useRegistroCassaSubscription` viene valutata in design solo per invalidare la cache del mese corrente, non per ricostruire l'infrastruttura live.
- Nuove tabelle/colonne DB, export PDF/Excel, dashboard configurabili dall'utente.

## Approach

1. **Fase backend (leggera, read-only)**: aggiungere `riepilogoAnnuale(anno)` e i campi tracciati a `RiepilogoMensileCassa` riusando i calcoli per-registro già esistenti (`incassoContanteTracciato`, `incassiElettronici`, `incassiFattura`, `speseFornitori`, `speseGiornaliere`, `contanteNetto`, `differenza`). Nessuna migrazione EF.
2. **Fase frontend**: installare `@mui/x-charts@^9`; decomporre la dashboard in componenti presentazionali + hook dati (`useDashboardData`); implementare KPI card con sparkline, donut distribuzione incassi (tracciato vs non tracciato vs elettronici vs fatture), bar/line trend 12 mesi, Sankey Recharts per il flusso di cassa; layout a gerarchia chiara (KPI primari in alto, flusso al centro, trend sotto) su grid Tailwind esistente, tema da `src/components/theme/theme.tsx` (palette ambra, dark/light via Zustand).
3. **Vincolo di implementazione (non negoziabile)**: le fasi design e apply DEVONO usare le skill di progetto **`interface-design`** (per gerarchia, densità, coerenza tema) e **`react-best-practices`** (pattern pagina/hook/stato del progetto).
4. **Rollout**: la nuova dashboard sostituisce in-place quella attuale in `HomePage.tsx`; nessun feature flag necessario (pagina interna, rollback = revert).

## Affected Areas

| Area | Impatto | Descrizione |
|------|---------|-------------|
| `duedgusto/package.json` | Modificato | Aggiunta `@mui/x-charts@^9` (Recharts 3.6 resta) |
| `duedgusto/src/components/pages/registrazioneCassa/RegistrazioneCassDashboard.tsx` | Riscritto | Da monolite 524 righe a orchestratore snello |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/**` | Nuovo | Sottocomponenti: KPI section, DonutDistribuzione, SankeyFlussoCassa, TrendMensile, hook `useDashboardData` |
| `duedgusto/src/components/common/KPICard.tsx` | Modificato | Variante con sparkline (`SparkLineChart` x-charts); eliminata copia locale |
| `duedgusto/src/graphql/registroCassa/queries.tsx` + nuovo `useQueryRiepilogoAnnuale.tsx` | Nuovo/Modificato | Query `riepilogoAnnuale` + estensione `GetRiepilogoMensile` |
| `backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs` (+ Services) | Modificato | Query aggregata annuale + campi tracciati nel riepilogo mensile |
| `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementQueriesTests.cs` | Modificato | Test per la nuova query |
| `duedgusto/src/components/pages/dashboard/HomePage.tsx` | Invariato/verifica | Continua a renderizzare la dashboard ridisegnata |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Recharts 3 + React 19.2.3: issue nota recharts#6857 (crash/incompatibilità runtime) | Media | Recharts limitato al SOLO componente Sankey, isolato e lazy-loaded; pin della versione Recharts testata; smoke test E2E Playwright sulla dashboard; fallback: sostituire il Sankey con barre impilate x-charts se il bug si manifesta |
| Convivenza due librerie grafici: ~145KB gzip extra sul bundle | Alta (certa) | `React.lazy` + code-splitting del blocco Sankey; verifica dimensione bundle in build; Recharts già presente nel bundle attuale quindi il delta reale è solo x-charts |
| Theming incoerente tra x-charts (automatico MUI) e Recharts (manuale) | Media | Palette centralizzata derivata da `theme.tsx` passata esplicitamente al Sankey; verifica dark/light in entrambi i modi |
| Estensione backend slitta o i calcoli aggregati divergono dalla vista mensile | Media | Contratto dati `RiepilogoDashboard` + adapter client-side temporaneo con le STESSE formule di `RiepilogoIncassiMensile.tsx`; test xUnit che confrontano aggregato server vs somma registri |
| Regressione percezione utente (redesign soggettivo) | Media | Uso vincolato della skill `interface-design`; review con l'utente su mockup/prima iterazione prima del completamento |
| Dati stantii da cache Apollo (già visto nel fix `33896a4` vista mensile) | Media | Fetch policy esplicita per le query aggregate + invalidazione via subscription per il mese corrente (decisione in design) |

## Rollback Plan

- Il cambiamento è confinato: revert dei commit frontend ripristina la dashboard attuale (nessuna migrazione DB, nessun dato modificato).
- La query backend `riepilogoAnnuale` è additiva e read-only: può restare deployata anche in caso di rollback frontend senza effetti collaterali.
- `@mui/x-charts` rimovibile con un semplice uninstall se si torna indietro.
- Nessun feature flag necessario; in caso di bug critico post-deploy: `git revert` + pipeline CI standard (deploy.yml).

## Dependencies

- `@mui/x-charts` ^9.x (MIT, Community — nessuna licenza a pagamento).
- Backend .NET disponibile per la nuova query (in alternativa: adapter client-side temporaneo).
- Skill di progetto `interface-design` e `react-best-practices` (obbligatorie in design/apply).
- Nessuna migrazione database.

## Success Criteria

- [ ] La dashboard mostra i 7 KPI gestionali (vendite, spese, differenza, ricavo tracciato/non tracciato, spese tracciate/non tracciate) coerenti al centesimo con la vista mensile.
- [ ] Presenti e funzionanti in dark e light mode: donut distribuzione incassi, Sankey flusso di cassa, trend 12 mesi (bar/line), sparkline nelle KPI card.
- [ ] La dashboard NON scarica più fino a 1000 registri: usa query aggregate server (o adapter documentato come temporaneo).
- [ ] Nessuna `KPICard` duplicata: si usa/estende `src/components/common/KPICard.tsx`.
- [ ] `npm run ts:check`, `npm run lint`, `npm run test` verdi; `dotnet build` + test xUnit verdi per la parte backend.
- [ ] Nessun crash Recharts/React 19 sul Sankey (smoke test E2E).
- [ ] Approvazione visiva esplicita dell'utente sul nuovo layout.
