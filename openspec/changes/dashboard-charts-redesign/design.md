# Design: Redesign Dashboard con Grafici (dashboard-charts-redesign)

## Technical Approach

La dashboard attuale (`duedgusto/src/components/pages/registrazioneCassa/RegistrazioneCassDashboard.tsx`, 524 righe) viene decomposta in un orchestratore snello + sottocomponenti presentazionali sotto `registrazioneCassa/dashboard/`, alimentati da un **contratto dati unico** (`RiepilogoDashboard`) prodotto dall'hook `useDashboardData`. I dati arrivano dalla **nuova query server aggregata** `gestioneCassa.riepilogoAnnuale(anno)` (12 riepiloghi mensili, stesse formule della vista mensile); un **adapter client** con le stesse formule fa da fallback finché il backend non è deployato. Grafici: **@mui/x-charts (Community)** per donut, bar, line e sparkline (theming MUI automatico) e **Recharts solo per il Sankey**, isolato, lazy-loaded e temizzato tramite una palette centralizzata derivata da `theme.tsx`.

Il redesign visivo applica la skill `interface-design`: gerarchia hero (Differenza come numero guida), banda KPI densa in stile vista mensile (il "linguaggio" che l'utente già conosce), sezione flusso di cassa come **firma visiva** della pagina, trend annuale in coda. Depth strategy: **borders-only** (`Paper variant="outlined"`), coerente con i pattern del progetto (react-best-practices §7, §13).

### Intent (interface-design)

- **Chi**: il titolare del ristorante. Apre la dashboard a fine giornata o al mattino con una domanda sola: "come sta andando la cassa? quanto sto tracciando?". Cinque minuti prima era sulla vista mensile o sul registro giornaliero.
- **Cosa deve fare**: leggere in 3 secondi la Differenza (vendite − spese) e il rapporto tracciato/non tracciato; poi esplorare distribuzione e trend; infine agire (Nuova Cassa, Vista Mensile).
- **Come deve sentirsi**: il quadro di controllo del registratore di cassa — caldo (ambra #ffab40 del brand), denso ma quieto, numeri monospazio-tabulari dove si confrontano cifre. Non un template "analytics" freddo.
- **Firma**: il **flusso del denaro** — il Sankey ambra→verde/ambra-scuro→rosso→netto che rende fisico il percorso vendite → tracciato/non tracciato → spese → differenza. Nessun'altra pagina dell'app ce l'ha; è la risposta visiva alla domanda fiscale dell'utente.
- **Default rifiutati**: (1) griglia di 8 card KPI identiche icon-left → banda KPI densa tipo `RiepilogoIncassiMensile` + un solo hero number; (2) pie "Contanti vs Elettronici" → donut a 4 fette semanticamente gestionali (contante tracciato / elettronici / fatture / non tracciato); (3) tre grafici impilati equivalenti → una sola sezione trend con bar+line combinati e gerarchia chiara.

## Architecture Decisions

### Decision: @mui/x-charts@^8 (NON ^9) come libreria principale

**Choice**: installare `@mui/x-charts@^8` (ultima 8.x, oggi 8.29.2).
**Alternatives considered**: `@mui/x-charts@^9` (indicato nel proposal); upgrade di `@mui/material` a v7; Recharts ovunque.
**Rationale**: verificato su npm che **x-charts v9 richiede `@mui/material ^7.3.0 || ^9.0.0`**, mentre il progetto usa `@mui/material ^6.4.8`: installarlo romperebbe i peer deps. La serie 8.x supporta `@mui/material ^5.15.14 || ^6 || ^7` e `react ^19`, ed espone tutti i componenti Community necessari (`PieChart`, `BarChart`, `LineChart`, `SparkLineChart`). L'upgrade di MUI core a v7 è fuori scope (impatta tutta l'app). Questa è una **correzione vincolata del proposal** da riportare all'orchestratore.

### Decision: ibrido x-charts + Recharts confinato al solo Sankey

**Choice**: tutti i grafici in x-charts tranne `SankeyFlussoCassa` (Recharts 3.6, già in bundle), caricato con `React.lazy` e protetto da un error boundary con fallback a barre impilate x-charts.
**Alternatives considered**: solo Recharts (nessun theming MUI automatico, issue #6857 con React 19 su tutta la pagina); MUI X Pro (Sankey a pagamento); rimuovere il Sankey.
**Rationale**: il Sankey è la firma visiva richiesta esplicitamente dall'utente; MUI X Community non lo offre. Isolarlo in un chunk lazy limita il rischio recharts#6857 a un solo componente con degradazione controllata (`SankeyErrorBoundary` → `FlussoCassaBarreImpilate`), e il code splitting evita di pagare Recharts al first paint.

### Decision: query server `riepilogoAnnuale(anno)` completamente nuova (nessuna estensione di `riepilogoMensile`)

**Choice**: creare da zero `RiepilogoMeseCassa`/`RiepilogoAnnualeCassa` (classi C# + GraphQL type) e il field `riepilogoAnnuale` in `GestioneCassaQueries.cs`.
**Alternatives considered**: estendere il tipo `RiepilogoMensileCassa` citato nel proposal.
**Rationale**: **scoperta in esplorazione**: `riepilogoMensile` NON esiste nel backend (grep su `backend/` non trova alcun `RiepilogoMensile`); la query frontend `GetRiepilogoMensile` in `queries.tsx` referenzia un field inesistente (codice morto, fallirebbe in validazione). Esiste solo il tipo TS `RiepilogoMensileCassa` in `src/@types/RegistroCassa.d.ts:163`. Quindi si progetta il tipo server pulito, senza vincoli legacy; `GetRiepilogoMensile`/`GetDashboardKPIs` vengono solo annotati come deprecati (cleanup fuori scope, come da proposal).

### Decision: formule identiche alla vista mensile, DRAFT inclusi, aggregazione SQL

**Choice**: il resolver replica al centesimo le formule di `VistaMensile.tsx` (righe 84-107): non filtra per `Stato` (i DRAFT concorrono ai totali, come nella vista mensile) e restituisce i contatori `registri/chiusi/bozze`. Aggregazione con `GroupBy(mese) + Sum` traducibile in SQL (niente `ToListAsync` di 365 registri).
**Alternatives considered**: filtrare su CLOSED/RECONCILED come fa `dashboardKPIs` (`StatiContabilizzati`).
**Rationale**: il criterio di successo del proposal è "coerenti al centesimo con la vista mensile", e la vista mensile somma tutti i registri. I contatori bozze permettono comunque alla UI di segnalare dati provvisori (chip "N bozze" come `RiepilogoIncassiMensile`). Nota: `TotaleVendite` è `decimal` non-nullable nel modello (`backend/Models/RegistroCassa.cs`), quindi il fallback `?? movimento+elettronici+fatture` della vista mensile non scatta mai lato server: il resolver usa direttamente `Sum(r => r.TotaleVendite)`.

### Decision: contratto dati `RiepilogoDashboard` + modulo formule condiviso

**Choice**: la UI consuma solo il tipo normalizzato `RiepilogoDashboard`; le formule client vivono in un unico modulo puro `src/common/registroCassa/aggregaRegistri.tsx`, usato dall'adapter di fallback e dai test di parità.
**Alternatives considered**: formule duplicate nell'hook (com'è oggi: `useQueryYearlySummary` duplica e diverge da `VistaMensile`).
**Rationale**: indirizza il rischio "divergenza calcoli server/client" del proposal: un solo posto client dove vivono le formule, testato contro fixture condivise; il test xUnit backend verifica la stessa parità lato server (aggregato vs somma registri seedati).

### Decision: fetch policy `cache-and-network` + refetch mirato via subscription

**Choice**: `useQuery(getRiepilogoAnnuale, { fetchPolicy: "cache-and-network", notifyOnNetworkStatusChange: true })`; `useRegistroCassaSubscription` nell'hook `useDashboardData` con refetch **solo se** `anno(evento.data) === annoSelezionato`; `keyFields` in cache per normalizzare i riepiloghi.
**Alternatives considered**: `network-only` (perde il paint istantaneo da cache); `cache-first` (esattamente il bug del fix `33896a4`: snapshot stantio dopo salvataggi da altre pagine); `refetchQueries` per nome dalle mutation (agisce solo su query attive, stesso limite documentato in `useQueryCashRegistersByMonth`).
**Rationale**: replica il pattern già validato dal fix `33896a4` (`useQueryCashRegistersByMonth.tsx` righe 30-34): mostra subito la cache ma rivalida sempre dalla rete; la subscription copre gli aggiornamenti mentre la dashboard è montata. In `configureClient.tsx` si aggiungono `typePolicies`: `RiepilogoAnnualeCassa: { keyFields: ["anno"] }`, `RiepilogoMeseCassa: { keyFields: ["anno", "mese"] }`.

### Decision: evoluzione retro-compatibile di `common/KPICard.tsx`

**Choice**: estendere `src/components/common/KPICard.tsx` con prop opzionali `variant?: "compact" | "hero"`, `trend?: number`, `sparklineData?: number[]`, `subtitle?: string`, `color?: string`. Default = comportamento attuale (card 120px quadrata usata da `RiepilogoCards.tsx`, che non deve cambiare). La copia locale in `RegistrazioneCassDashboard.tsx` viene eliminata.
**Alternatives considered**: nuovo componente `DashboardKpiCard` separato (duplicherebbe ancora); modificare la firma esistente (romperebbe `RiepilogoCards`).
**Rationale**: unico componente KPI nel progetto come richiesto dal proposal; le prop opzionali con default preservano i 9 utilizzi esistenti. La sparkline usa `SparkLineChart` x-charts (area, colore dal tema, ~40px di altezza) solo in `variant="hero"`.

## Layout della Dashboard (gerarchia visiva)

Struttura pagina secondo react-best-practices §1 (flex column, scroll singolo, `height: calc(100vh - 64px)`), griglia contenuti su Tailwind `grid-cols-12` esistente. Depth: solo bordi (`Paper variant="outlined"`), nessuna elevation mista. Spaziatura base 8px (`gap-4` griglia, `p: 2.5` nelle card sezione).

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER (flexShrink 0, borderBottom divider)                         │
│  "Dashboard Cassa"  [Anno ▾]        [+ Nuova Cassa] [Lista] [Mens.] │
├─────────────────────────────────────────────────────────────────────┤
│ CONTENUTO (flex 1, overflow auto, minHeight 0)                      │
│ ┌─ HERO KPI (col-span-12) ─────────────────────────────────────────┐│
│ │  DIFFERENZA {anno}        │ Vendite  Spese  Ric.tracc  Ric.n.tr. ││
│ │  € 128.450,10  ▲ +4,2%    │ Sp.tracc  Sp.n.tracc   [N registri] ││
│ │  (h3, sparkline 12 mesi)  │ (banda densa stile RiepilogoIncassi) ││
│ └──────────────────────────────────────────────────────────────────┘│
│ ┌─ FLUSSO DI CASSA (col-span-12 lg:col-span-8) ─┐ ┌─ DONUT (lg:4) ─┐│
│ │  Sankey (lazy):                               │ │ Distribuzione  ││
│ │  Vendite ⇒ Tracciato / Non tracciato          │ │ incassi: cont. ││
│ │          ⇒ Spese traccia./non traccia. ⇒ Netto│ │ tracc/elettr/  ││
│ │  (fallback: barre impilate x-charts)          │ │ fatture/non tr.││
│ └───────────────────────────────────────────────┘ └────────────────┘│
│ ┌─ TREND MENSILE (col-span-12) ────────────────────────────────────┐│
│ │  BarChart x-charts: Vendite vs Spese per mese                    ││
│ │  + LineChart overlay: Differenza (linea ambra)                   ││
│ └──────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

Dettagli di craft:

- **Hero**: la Differenza è l'unico numero grande della pagina (`Typography h3`, `fontWeight bold`, `primary.main` se ≥ 0 altrimenti `error.main`), con trend % vs anno precedente non disponibile → trend vs mese precedente del mese corrente, e sparkline della differenza mensile. Gli altri 6 KPI usano la **banda densa** già familiare dalla vista mensile (caption + body1 bold + divider verticali, stessi colori semantici di `RiepilogoIncassiMensile`: vendite `primary`, spese `error` con prefisso −, tracciato `success`, non tracciato `warning`). Chip `N registri` / `N bozze` a destra.
- **Numeri**: `fontVariantNumeric: "tabular-nums"` su tutti i valori monetari per allineamento in colonna; formattazione sempre via `formatCurrency` (bones).
- **Colori**: nessun hex hardcodato nei componenti; tutto da `useChartPalette()` (sotto). Sfondi delicati con `alpha(theme.palette.X, 0.06-0.12)` (react-best-practices §14).
- **Mese vs anno**: il toggle "mese corrente / anno" del vecchio dashboard sparisce; l'hero mostra l'anno selezionato e il sottotitolo riporta il mese corrente (es. "Luglio: € 12.340,00") quando `anno === annoCorrente`. Riduce una decisione cognitiva e una riga di KPI duplicati.

### Donut distribuzione incassi (x-charts `PieChart`)

4 fette con `innerRadius` ~60%: Contante tracciato (`success.main`), Elettronici (`info.main`), Fatture (`secondary.main`), Non tracciato (`warning.main`). Centro: totale vendite anno. Legenda a destra su desktop, sotto su mobile. `valueFormatter` → `€ formatCurrency`. Clamp a 0 dei valori negativi (non tracciato può risultare negativo su dati sporchi) con nota nel tooltip.

### Sankey flusso di cassa (Recharts, lazy)

Nodi e link (valori clampati a ≥ 0; i residui garantiscono conservazione del flusso):

| Da | A | Valore |
|----|---|--------|
| Vendite | Ricavo tracciato | `ricavoTracciato` |
| Vendite | Ricavo non tracciato | `max(ricavoNonTracciato, 0)` |
| Ricavo tracciato | Spese tracciate | `min(speseTracciate, ricavoTracciato)` |
| Ricavo tracciato | Netto | residuo tracciato |
| Ricavo non tracciato | Spese non tracciate | `min(speseNonTracciate, ricavoNonTracciato)` |
| Ricavo non tracciato | Netto | residuo non tracciato |

Colori nodi/link dalla palette centralizzata (link con `alpha 0.35`); tooltip custom con `Paper` MUI (bg `background.paper`, bordo `divider`) così dark/light sono automatici. Se una spesa eccede il ramo di provenienza il delta viene sottratto dal nodo Netto (il Sankey non ammette valori negativi: caso documentato nel tooltip "Netto" con il valore reale `differenza`).

## Data Flow

```
                       ┌──────────────────────────────────────────────┐
                       │ RegistrazioneCassDashboard (orchestratore)   │
                       │   selectedYear (useState)                    │
                       └───────────────┬──────────────────────────────┘
                                       │ anno
                            ┌──────────▼──────────┐
                            │ useDashboardData    │──── useRegistroCassaSubscription
                            │  (contratto unico)  │      │ evento(data, azione)
                            └──────┬───────┬──────┘      │ anno(evento)==anno? → refetch()
             query server ok       │       │ GRAPHQL_VALIDATION_FAILED
        ┌──────────────────────────▼─┐   ┌─▼───────────────────────────────┐
        │ useQueryRiepilogoAnnuale   │   │ useQueryRiepilogoAnnualeAdapter │
        │ riepilogoAnnuale(anno)     │   │ getRegistriCassa(anno) +        │
        │ cache-and-network          │   │ aggregaRegistriPerMese() (bones)│
        └──────────────┬─────────────┘   └─┬───────────────────────────────┘
                       └─────────┬─────────┘
                                 ▼  RiepilogoDashboard (12 mesi + totaliAnno + derivati)
        ┌────────────┬───────────┴────────────┬─────────────────┐
        ▼            ▼                        ▼                 ▼
  HeroKpiSection  DonutDistribuzione   SankeyFlussoCassa   TrendMensile
  (KPICard hero   Incassi (PieChart)   (React.lazy +       (BarChart +
   + banda densa)                       ErrorBoundary →     LineChart)
                                        BarreImpilate)
```

### Sequence: caricamento + invalidazione live

```
Utente          Dashboard        useDashboardData      Apollo/Server        Subscription(WS)
  │ apre pagina    │                    │                    │                    │
  │───────────────>│ mount              │                    │                    │
  │                │───anno corrente───>│                    │                    │
  │                │                    │──cache-and-network─>│ (cache: paint     │
  │                │<──dati cache───────│                    │  immediato se hit) │
  │                │<──dati rete────────│<──riepilogoAnnuale──│                    │
  │ salva cassa    │                    │                    │                    │
  │ (altra pagina) │                    │                    │──onRegistroCassa──>│
  │                │                    │<──evento(data,azione)───────────────────│
  │                │                    │ anno(evento)==anno selezionato?         │
  │                │                    │──refetch()────────>│                    │
  │                │<──dati aggiornati──│<───────────────────│                    │
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `duedgusto/package.json` | Modify | Aggiunta `@mui/x-charts@^8` (correzione: NON ^9, peer dep MUI v6) |
| `duedgusto/src/components/pages/registrazioneCassa/RegistrazioneCassDashboard.tsx` | Rewrite | Orchestratore snello: layout flex column, stato anno, composizione sezioni (~100 righe) |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/DashboardHeader.tsx` | Create | Titolo, select anno (MenuItem), azioni Nuova Cassa/Lista/Vista Mensile (useCallback) |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/HeroKpiSection.tsx` | Create | Hero Differenza (KPICard variant hero + sparkline) + banda KPI densa 6 metriche + chip registri/bozze |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/DonutDistribuzioneIncassi.tsx` | Create | `PieChart` x-charts a 4 fette, centro con totale, empty state |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/SankeyFlussoCassa.tsx` | Create | Recharts Sankey, tooltip MUI, palette da `useChartPalette`; export default per lazy |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/SankeyErrorBoundary.tsx` | Create | Error boundary di classe: cattura crash Recharts (issue #6857) → rende il fallback |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/FlussoCassaBarreImpilate.tsx` | Create | Fallback: `BarChart` x-charts impilato (tracciato/non tracciato/spese/netto) |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/TrendMensile.tsx` | Create | Bar Vendite vs Spese + linea Differenza, 12 mesi, x-charts |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/useDashboardData.tsx` | Create | Hook: query server → fallback adapter, subscription refetch, derivati memoizzati (EMPTY_ARRAY stabile) |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/useChartPalette.tsx` | Create | Palette grafici centralizzata da `useTheme()` (unica fonte per x-charts e Recharts) |
| `duedgusto/src/common/registroCassa/aggregaRegistri.tsx` | Create | Funzioni pure: `aggregaRegistriPerMese`, `derivaTotali` — stesse formule di `VistaMensile.tsx` |
| `duedgusto/src/graphql/registroCassa/queries.tsx` | Modify | Aggiunta `getRiepilogoAnnuale`; commento `@deprecated` su `getRiepilogoMensile`/`getDashboardKPIs` (field server inesistente / hook inutilizzato) |
| `duedgusto/src/graphql/registroCassa/useQueryRiepilogoAnnuale.tsx` | Create | Hook query server con fetch policy e normalizzazione (mesi sempre 12) |
| `duedgusto/src/graphql/configureClient.tsx` | Modify | `typePolicies` keyFields per `RiepilogoAnnualeCassa` / `RiepilogoMeseCassa` |
| `duedgusto/src/components/common/KPICard.tsx` | Modify | Prop opzionali `variant/trend/sparklineData/subtitle/color` retro-compatibili |
| `duedgusto/src/@types/RegistroCassa.d.ts` | Modify | Tipi `RiepilogoMeseDashboard`, `RiepilogoDashboard` |
| `backend/GraphQL/GestioneCassa/GestioneCassaQueries.cs` | Modify | Field `riepilogoAnnuale(anno)` con GroupBy/Sum SQL + classi `RiepilogoMeseCassa`, `RiepilogoAnnualeCassa` |
| `backend/GraphQL/GestioneCassa/Types/RiepilogoAnnualeCassaType.cs` | Create | GraphQL types `RiepilogoMeseCassaType`, `RiepilogoAnnualeCassaType` |
| `backend/DuedGusto.Tests/Integration/GraphQL/CashManagementQueriesTests.cs` | Modify | Test `riepilogoAnnuale`: parità al centesimo, 12 mesi, anno vuoto, DRAFT inclusi |
| `duedgusto/src/graphql/registroCassa/__tests__/useQueryRiepilogoAnnuale.test.tsx` | Create | Test hook (MockedProvider): dati, fallback adapter, refetch da subscription |
| `duedgusto/src/common/registroCassa/__tests__/aggregaRegistri.test.tsx` | Create | Test parità formule con fixture della vista mensile |
| `duedgusto/src/components/pages/registrazioneCassa/dashboard/__tests__/*.test.tsx` | Create | Render sezioni con mock `RiepilogoDashboard` (valori, empty, error) |

Nota: `HomePage.tsx` resta invariato (continua a rendere `RegistrazioneCassDashboard`). `useQueryYearlySummary.tsx` resta ma perde l'unico consumatore: annotare `@deprecated`, rimozione in cleanup separato.

## Interfaces / Contracts

### Schema GraphQL server (additivo, nessuna migrazione EF)

```graphql
type RiepilogoMeseCassa {
  anno: Int!
  mese: Int!               # 1-12, sempre presenti tutti i 12 mesi
  totaleVendite: Decimal!
  ricavoTracciato: Decimal!      # Σ incassoContanteTracciato + incassiElettronici + incassiFattura
  ricavoNonTracciato: Decimal!   # Σ (totaleChiusura - totaleApertura) - incassoContanteTracciato
  speseTracciate: Decimal!       # Σ speseFornitori
  speseNonTracciate: Decimal!    # Σ speseGiornaliere
  incassoContanteTracciato: Decimal!
  incassiElettronici: Decimal!
  incassiFattura: Decimal!
  registri: Int!
  chiusi: Int!                   # stato CLOSED o RECONCILED
  bozze: Int!                    # stato DRAFT
}

type RiepilogoAnnualeCassa {
  anno: Int!
  mesi: [RiepilogoMeseCassa!]!   # esattamente 12
}

# In GestioneCassaQueries (namespace gestioneCassa, .Authorize() già a livello di classe):
riepilogoAnnuale(anno: Int!): RiepilogoAnnualeCassa!
```

Resolver (pattern del progetto — `GraphQLService.GetService<AppDbContext>(context)`):

```csharp
Field<RiepilogoAnnualeCassaType, RiepilogoAnnualeCassa>("riepilogoAnnuale")
    .Argument<NonNullGraphType<IntGraphType>>("anno")
    .ResolveAsync(async context =>
    {
        AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
        int anno = context.GetArgument<int>("anno");
        var aggregati = await dbContext.RegistriCassa
            .Where(r => r.Data.Year == anno)
            .GroupBy(r => r.Data.Month)
            .Select(g => new RiepilogoMeseCassa
            {
                Anno = anno,
                Mese = g.Key,
                TotaleVendite = g.Sum(r => r.TotaleVendite),
                RicavoTracciato = g.Sum(r => r.IncassoContanteTracciato + r.IncassiElettronici + r.IncassiFattura),
                RicavoNonTracciato = g.Sum(r => (r.TotaleChiusura - r.TotaleApertura) - r.IncassoContanteTracciato),
                SpeseTracciate = g.Sum(r => r.SpeseFornitori),
                SpeseNonTracciate = g.Sum(r => r.SpeseGiornaliere),
                IncassoContanteTracciato = g.Sum(r => r.IncassoContanteTracciato),
                IncassiElettronici = g.Sum(r => r.IncassiElettronici),
                IncassiFattura = g.Sum(r => r.IncassiFattura),
                Registri = g.Count(),
                Chiusi = g.Count(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED"),
                Bozze = g.Count(r => r.Stato == "DRAFT"),
            })
            .ToListAsync();
        // Riempimento dei mesi mancanti (12 elementi garantiti) in memoria
        return RiepilogoAnnualeCassa.CompletaDodiciMesi(anno, aggregati);
    });
```

### Contratto dati frontend (`src/@types/RegistroCassa.d.ts`)

```tsx
type RiepilogoMeseDashboard = {
  anno: number;
  mese: number; // 1-12
  totaleVendite: number;
  ricavoTracciato: number;
  ricavoNonTracciato: number;
  speseTracciate: number;
  speseNonTracciate: number;
  incassoContanteTracciato: number;
  incassiElettronici: number;
  incassiFattura: number;
  registri: number;
  chiusi: number;
  bozze: number;
  // Derivati client (calcolati in aggregaRegistri/derivaTotali, mai richiesti al server)
  totaleSpese: number;   // speseTracciate + speseNonTracciate
  differenza: number;    // totaleVendite - totaleSpese
};

type RiepilogoDashboard = {
  anno: number;
  mesi: RiepilogoMeseDashboard[]; // sempre 12, indicizzati mese-1
  totaliAnno: Omit<RiepilogoMeseDashboard, "mese">;
  meseCorrente: RiepilogoMeseDashboard | null; // solo se anno === anno corrente
  fonte: "server" | "adapter"; // per banner/log diagnostico
};
```

### Query + hook client

```tsx
export const getRiepilogoAnnuale: TypedDocumentNode<GetRiepilogoAnnualeData, { anno: number }> = gql(`
  query GetRiepilogoAnnuale($anno: Int!) {
    gestioneCassa {
      riepilogoAnnuale(anno: $anno) {
        anno
        mesi {
          anno mese totaleVendite ricavoTracciato ricavoNonTracciato
          speseTracciate speseNonTracciate
          incassoContanteTracciato incassiElettronici incassiFattura
          registri chiusi bozze
        }
      }
    }
  }`);
```

`useDashboardData({ anno })`:
1. `useQueryRiepilogoAnnuale` con `fetchPolicy: "cache-and-network"`, `notifyOnNetworkStatusChange: true`.
2. Se `error` contiene un errore di validazione sul field (`GRAPHQL_VALIDATION_FAILED` / message `Cannot query field "riepilogoAnnuale"`), attiva l'adapter: `useQuery(getRegistriCassa)` sull'anno (skip altrimenti) + `aggregaRegistriPerMese(items)` → stessa shape, `fonte: "adapter"`. L'adapter è **temporaneo e documentato**: va rimosso quando il backend è deployato.
3. `useRegistroCassaSubscription`: al cambio evento (`useRef` sul precedente, pattern `VistaMensile.tsx` righe 66-73) esegue `refetch()` solo se l'anno della `data` dell'evento coincide con l'anno selezionato.
4. Derivati con catena `useMemo` (react-best-practices §12) e costante modulo `EMPTY_MESI` per riferimenti stabili (§3).

### Palette grafici centralizzata (`useChartPalette.tsx`)

Unica fonte colore per ENTRAMBE le librerie (indirizza il rischio theming incoerente):

```tsx
function useChartPalette() {
  const theme = useTheme();
  return useMemo(() => ({
    vendite: theme.palette.primary.main,        // ambra — identità
    tracciato: theme.palette.success.main,
    nonTracciato: theme.palette.warning.main,
    elettronici: theme.palette.info.main,
    fatture: theme.palette.secondary.main,
    spese: theme.palette.error.main,
    netto: theme.palette.primary.main,
    linkAlpha: (color: string) => alpha(color, 0.35),
    tooltip: {
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      color: theme.palette.text.primary,
    },
  }), [theme]);
}
```

x-charts riceve i colori via prop `colors`/`series.color` (e il resto del theming — assi, tooltip, font — è automatico da MUI ThemeProvider); il Sankey Recharts riceve nodi/link colorati esplicitamente + tooltip custom con `Paper`. Cambiando `theme.tsx` cambiano entrambi.

### Lazy loading / code splitting

```tsx
const SankeyFlussoCassa = lazy(() => import("./dashboard/SankeyFlussoCassa"));
// Uso:
<SankeyErrorBoundary fallback={<FlussoCassaBarreImpilate dati={riepilogo} />}>
  <Suspense fallback={<Skeleton variant="rounded" height={320} />}>
    <SankeyFlussoCassa dati={riepilogo} />
  </Suspense>
</SankeyErrorBoundary>
```

- Recharts finisce nel chunk di `SankeyFlussoCassa` (unico import residuo dopo la riscrittura del monolite: verificare in build che nessun altro file importi `recharts`).
- `SankeyErrorBoundary` è un class component (`componentDidCatch`) che logga via `logger` e monta il fallback x-charts: degradazione silenziosa se recharts#6857 si manifesta con React 19.2.3.

## Stati loading / empty / error

| Stato | Trattamento |
|-------|-------------|
| Primo caricamento (nessun dato in cache) | Skeleton per sezione (hero: 1 riga skeleton; grafici: `Skeleton variant="rounded"` con le altezze reali) — niente spinner full-page, la struttura resta visibile |
| Rivalidazione (`cache-and-network` con dati) | `LinearProgress` assoluto a `height: 0` sotto l'header (pattern `VistaMensile.tsx` righe 204-206); i dati correnti restano visibili |
| Errore query (e adapter fallito) | `Alert severity="error"` al posto del contenuto con messaggio + bottone Riprova (`refetch`) |
| Anno senza registri (`totaliAnno.registri === 0`) | Empty state unico al posto di grafici vuoti: icona + "Nessun registro per il {anno}" + CTA "Nuova Cassa" |
| `fonte === "adapter"` | Nessun banner utente; `logger.warn` per diagnostica (l'adapter è trasparente per l'utente) |
| Valori negativi (ricavoNonTracciato < 0) | Donut/Sankey clampano a 0; il valore reale resta visibile nella banda KPI e nei tooltip |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit FE (Vitest) | `aggregaRegistri`: parità al centesimo con le formule di `VistaMensile` su fixture condivise (incl. registri DRAFT, valori null, non tracciato negativo) | Test puri, fixture in `__tests__/fixtures` |
| Unit FE | `useQueryRiepilogoAnnuale` / `useDashboardData`: dati server, attivazione adapter su GRAPHQL_VALIDATION_FAILED, refetch su evento subscription anno-corrispondente (e NON per altri anni) | `MockedProvider` Apollo + `renderHook` |
| Unit FE | `KPICard` retro-compatibilità (snapshot variant compact invariata) + variant hero con trend/sparkline | Testing Library |
| Unit FE | Sezioni dashboard: valori formattati, empty state, clamp negativi nel donut, `SankeyErrorBoundary` monta il fallback quando il figlio lancia | Testing Library, mock `RiepilogoDashboard` |
| Integration BE (xUnit) | `riepilogoAnnuale`: 12 mesi sempre presenti; parità aggregato vs somma manuale dei registri seedati; DRAFT inclusi nei totali e contati in `bozze`; anno vuoto → 12 mesi a zero; `.Authorize()` attivo | Estensione `CashManagementQueriesTests.cs` (pattern esistente) |
| E2E (Playwright) | Smoke: dashboard carica senza errori console (guardia recharts#6857), donut/sankey/trend visibili, cambio anno aggiorna i valori | `npm run test:e2e` |
| Visual (Playwright) | Screenshot dashboard dark + light | `npm run test:visual` (nuovi snapshot) |
| Build | `npm run ts:check`, `npm run lint`, `npm run build` (verifica chunk recharts separato), `dotnet build` + `dotnet test` | CI esistente |

## Migration / Rollout

Nessuna migrazione database (solo aggregazioni su colonne esistenti di `RegistriCassa`). Rollout in-place come da proposal:

1. **Fase backend-first**: deploy della query `riepilogoAnnuale` (additiva, innocua per il frontend attuale).
2. **Fase frontend**: nuova dashboard con hook che usa il server; l'adapter copre l'eventuale finestra in cui il frontend arriva prima del backend (o ambienti non aggiornati).
3. Rollback: `git revert` frontend ripristina la dashboard attuale; la query backend può restare deployata.

## Open Questions

- [ ] **Approvazione visiva utente** (criterio di successo del proposal): confermare in apply, alla prima iterazione renderizzata, la scelta "Differenza come hero + banda KPI densa" prima di rifinire.
- [ ] Il proposal indica `@mui/x-charts@^9`: la verifica peer-deps impone `^8` con MUI v6 — l'orchestratore deve validare questa correzione (in alternativa serve l'upgrade MUI core v7, fuori scope).
- [ ] Trend % dell'hero: vs mese precedente (dato disponibile) — confermare che non serva il confronto anno-su-anno (richiederebbe una seconda query `riepilogoAnnuale(anno-1)`, fattibile ma rimandabile).
