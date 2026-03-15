# Design: Fix filtraggio Searchbox e copertura test completa

## Approccio Tecnico

Il cambiamento si articola in due parti complementari:

1. **Fix del bug**: modifica di un singolo operatore logico (`OR` -> `AND`) nella funzione `useSearchboxQueryParams` che costruisce la clausola WHERE per le query GraphQL della Searchbox. Il fix garantisce che `regularWhere` (filtro di ricerca utente) e `additionalWhere` (condizione aggiuntiva configurabile) siano combinati in AND, restringendo i risultati anziche' ampliarli.

2. **Copertura test**: aggiunta di test unitari (Vitest) per la logica di costruzione WHERE e test E2E (Playwright) per il flusso completo di filtraggio progressivo su pagina reale.

## Decisioni Architetturali

### Decisione: Fix minimale OR -> AND

**Scelta**: Cambiare `.join(" OR ")` in `.join(" AND ")` alla riga 33 di `useSearchboxQueryParams.tsx`.

**Alternative considerate**:
- Operatore configurabile (`additionalWhereOperator: "AND" | "OR"`) nel tipo `SearchboxOptions`
- Refactoring completo della costruzione WHERE con un query builder

**Motivazione**: Nessuna delle 5 configurazioni searchboxOptions (`fornitoreSearchboxOptions`, `utenteSearchboxOptions`, `ruoloSearchboxOptions`, `menuSearchboxOptions`, `fatturaAcquistoSearchboxOptions`) usa attualmente `additionalWhere`. L'OR e' semplicemente un bug -- non esiste un caso d'uso legittimo per OR in questo contesto. La semantica corretta e': "mostra risultati che corrispondono alla ricerca **E** soddisfano la condizione aggiuntiva". Un operatore configurabile sarebbe over-engineering senza un requisito concreto.

### Decisione: Test unitari per useSearchboxQueryParams con renderHook

**Scelta**: Testare `useSearchboxQueryParams` tramite `renderHook` di `@testing-library/react`, mockando `useQueryParams` per isolare la logica di costruzione WHERE.

**Alternative considerate**:
- Estrarre la logica WHERE in una funzione pura e testarla direttamente
- Testare indirettamente tramite test del componente Searchbox

**Motivazione**: `useSearchboxQueryParams` e' un hook React che usa `useMemo`. Estrarre la logica in una funzione pura richiederebbe un refactoring che esula dallo scope di questo fix. Testare via `renderHook` con mock di `useQueryParams` permette di verificare esattamente il valore `where` passato, senza dipendenze da Apollo Client o dalla rete. Questo approccio segue il pattern gia' usato in `src/graphql/common/__tests__/useQueryParams.test.tsx`.

### Decisione: Test E2E nella directory e2e/functional/ (separata da visual-regression)

**Scelta**: Creare una nuova directory `e2e/functional/` per i test E2E funzionali, separata da `e2e/visual-regression/`.

**Alternative considerate**:
- Aggiungere i test in `e2e/visual-regression/` accanto ai test esistenti
- Creare `e2e/searchbox/` come directory dedicata

**Motivazione**: I test esistenti in `e2e/visual-regression/` sono tutti screenshot-based (usano `toHaveScreenshot`). I test funzionali della Searchbox verificano comportamento (digitazione, filtraggio, selezione), non aspetto visivo. Mescolarli causerebbe confusione. Una directory `e2e/functional/` e' piu' scalabile e permette di aggiungere test funzionali per altri componenti in futuro. L'infrastruttura condivisa (auth setup, helpers) puo' essere riutilizzata.

### Decisione: Test E2E con backend reale (no mock GraphQL)

**Scelta**: I test E2E usano il backend reale (come i test visual-regression esistenti), con `webServer` configurato in `playwright.config.ts` per avviare il frontend.

**Alternative considerate**:
- Mock delle risposte GraphQL con `page.route()` di Playwright
- MSW (Mock Service Worker) per intercettare le richieste

**Motivazione**: L'infrastruttura Playwright esistente gia' assume un backend running (auth.setup.ts fa login reale). Mockare GraphQL nei test E2E eliminerebbe il valore di testare il flusso end-to-end reale. Il backend deve essere avviato separatamente (`cd backend && dotnet run`), come indicato nei prerequisiti dell'auth setup. Il test E2E verifica che il filtraggio funzioni realmente contro il database, non contro dati finti.

## Flusso Dati

### Flusso di filtraggio Searchbox (stato attuale con bug)

```
Utente digita "pasta"    additionalWhere = "fornitore.attivo = 1"
       │                              │
       v                              v
useSearchboxQueryParams.tsx
       │
       ├─ regularWhere = "fornitori.ragioneSociale LIKE \"%pasta%\""
       │
       └─ WHERE = (fornitori.ragioneSociale LIKE "%pasta%") OR (fornitore.attivo = 1)
                                                             ^^^
                                                          BUG: OR
```

Risultato: la query restituisce TUTTE le righe attive + quelle che contengono "pasta", anziche' solo le righe attive che contengono "pasta".

### Flusso di filtraggio Searchbox (dopo il fix)

```
Utente digita "pasta"    additionalWhere = "fornitore.attivo = 1"
       │                              │
       v                              v
useSearchboxQueryParams.tsx
       │
       ├─ regularWhere = "fornitori.ragioneSociale LIKE \"%pasta%\""
       │
       └─ WHERE = (fornitori.ragioneSociale LIKE "%pasta%") AND (fornitore.attivo = 1)
                                                             ^^^^
                                                           FIX: AND
```

### Diagramma di sequenza: flusso completo di ricerca

```
  Utente          Searchbox.tsx      useSearchbox       useQueryParams     useFetchData        Apollo        Backend
    │                  │             QueryParams.tsx          │                 │              Client        GraphQL
    │                  │                  │                   │                 │                │              │
    │─ digita "pa" ──>│                  │                   │                 │                │              │
    │                  │─ setInnerValue  │                   │                 │                │              │
    │                  │─ setResults     │                   │                 │                │              │
    │                  │  Visible(true)  │                   │                 │                │              │
    │                  │                  │                   │                 │                │              │
    │                  │── value="pa" ──>│                   │                 │                │              │
    │                  │                  │─ calcola WHERE   │                 │                │              │
    │                  │                  │  con useMemo     │                 │                │              │
    │                  │                  │                   │                 │                │              │
    │                  │                  │── where, body ──>│                 │                │              │
    │                  │                  │                   │─ genera GQL    │                │              │
    │                  │                  │                   │  query +       │                │              │
    │                  │                  │                   │  variables     │                │              │
    │                  │                  │                   │                 │                │              │
    │                  │<── query, variables ────────────────│                 │                │              │
    │                  │                  │                   │                 │                │              │
    │                  │── query, vars, skip=false ─────────────────────────>│                │              │
    │                  │                  │                   │                 │                │              │
    │                  │                  │                   │                 │─ debounce     │              │
    │                  │                  │                   │                 │  300ms        │              │
    │                  │                  │                   │                 │                │              │
    │                  │                  │                   │                 │── watchQuery ─>│              │
    │                  │                  │                   │                 │                │── HTTP ─────>│
    │                  │                  │                   │                 │                │              │
    │                  │                  │                   │                 │                │<── items ────│
    │                  │                  │                   │                 │<── data ───────│              │
    │                  │                  │                   │                 │                │              │
    │                  │<── items[], loading=false ──────────────────────────│                │              │
    │                  │                  │                   │                 │                │              │
    │<── GridResults ──│                  │                   │                 │                │              │
    │   (dropdown)     │                  │                   │                 │                │              │
```

### Diagramma: costruzione WHERE in useSearchboxQueryParams

```
Input: value="pasta fresca", tableName="fornitori", fieldName="ragioneSociale"
       additionalWhere="fornitori.attivo = 1"

  1. Split + trim: ["pasta", "fresca"]
  2. Wrap LIKE:    ['"%pasta%"', '"%fresca%"']
  3. regularWhere: 'fornitori.ragioneSociale LIKE "%pasta%" AND fornitori.ragioneSociale LIKE "%fresca%"'
  4. Filter empty: ['fornitori.ragioneSociale LIKE ...', 'fornitori.attivo = 1']
  5. Parenthesize: ['(fornitori.ragioneSociale LIKE ...)', '(fornitori.attivo = 1)']
  6. Join AND:     '(fornitori.ragioneSociale LIKE ...) AND (fornitori.attivo = 1)'
       ^^^^^
       FIX (era OR)
```

## Modifiche ai File

| File | Azione | Descrizione |
|------|--------|-------------|
| `src/components/common/form/searchbox/useSearchboxQueryParams.tsx` | Modifica | Cambiare `.join(" OR ")` in `.join(" AND ")` alla riga 33 |
| `src/components/common/form/searchbox/__tests__/useSearchboxQueryParams.test.tsx` | Crea | Test unitari per la logica di costruzione WHERE clause |
| `src/components/common/form/searchbox/__tests__/Searchbox.test.tsx` | Crea | Test unitari per il componente Searchbox (rendering, input, keyboard, risultati) |
| `e2e/functional/searchbox.spec.ts` | Crea | Test E2E per filtraggio progressivo, griglia vuota, selezione |
| `e2e/functional/helpers.ts` | Crea | Helper condivisi per test funzionali (riusa pattern da visual-regression/helpers.ts) |

## Interfacce / Contratti

Nessuna nuova interfaccia da creare. L'unica modifica e' il comportamento interno di `useSearchboxQueryParams`.

Il contratto del tipo `SearchboxOptions<T>` resta invariato:

```typescript
// src/@types/searchbox.d.ts (INVARIATO)
interface SearchboxOptions<T extends Record<string, unknown>> {
  query: string;
  id: Extract<keyof T, string>;
  tableName: string;
  additionalWhere?: string;  // ora combinato con AND (era OR)
  view?: string;
  items: DatagridColDef<T>[];
  modal: {
    title: string;
    fragment?: string;
    items: DatagridColDef<T>[];
  };
}
```

La semantica di `additionalWhere` cambia da "condizione aggiunta in OR" a "condizione aggiunta in AND", che e' il comportamento corretto e atteso.

## Strategia di Testing

| Livello | Cosa Testare | Approccio |
|---------|-------------|-----------|
| Unit | Costruzione WHERE con singola parola | `renderHook` + mock `useQueryParams`, verifica argomento `where` |
| Unit | Costruzione WHERE con parole multiple | Verifica che le parole siano concatenate con `AND lookupField LIKE` |
| Unit | WHERE con `additionalWhere` | Verifica join con AND (non OR) e parenthesizzazione |
| Unit | WHERE senza `additionalWhere` | Verifica che il WHERE sia solo `regularWhere` senza parentesi |
| Unit | WHERE con input vuoto | Verifica che `where` sia stringa vuota |
| Unit | Spazi extra nell'input | Verifica trim e split corretti |
| Unit | Body in modalita' dropdown vs modale | Verifica che `body` contenga i campi corretti |
| Unit | Rendering Searchbox con valore iniziale | `render` + verifica `input.value` |
| Unit | Digitazione aggiorna input | `userEvent.type` + verifica valore |
| Unit | Risultati visibili durante digitazione | Verifica presenza `ContainerGridResults` (mockato) |
| Unit | "Nessun risultato" con input > 2 char e 0 items | Mock `useFetchData` con items vuoti |
| Unit | Escape/Tab chiude risultati | `userEvent.keyboard` + verifica assenza dropdown |
| E2E | Filtraggio progressivo su pagina reale | Digitare nel searchbox fornitore, verificare che i risultati appaiano e si restringano |
| E2E | Griglia vuota con testo senza match | Digitare testo assurdo, verificare "Nessun risultato trovato" |
| E2E | Selezione elemento dal dropdown | Digitare, cliccare risultato, verificare campo popolato |

### Organizzazione file di test

```
src/components/common/form/searchbox/
├── __tests__/
│   ├── FormikSearchbox.test.tsx          (esistente)
│   ├── useSearchboxQueryParams.test.tsx  (NUOVO - test logica WHERE)
│   └── Searchbox.test.tsx               (NUOVO - test componente)
├── Searchbox.tsx
├── useSearchboxQueryParams.tsx
├── ...

e2e/
├── visual-regression/                    (esistente)
│   ├── auth.setup.ts
│   ├── helpers.ts
│   └── *.spec.ts
├── functional/                           (NUOVO)
│   ├── helpers.ts                        (riusa AUTH_STATE_PATH e pattern da visual-regression)
│   └── searchbox.spec.ts                 (test E2E funzionali Searchbox)
```

### Dettaglio test unitari: useSearchboxQueryParams.test.tsx

Pattern di mock:

```typescript
// Mock useQueryParams per catturare i parametri passati
vi.mock("../../../../graphql/common/useQueryParams", () => ({
  default: vi.fn((params) => ({
    query: {},  // mock GQL document
    variables: { where: params.where, pageSize: params.pageSize },
  })),
}));
```

Casi di test:
1. `value="pasta"`, no additionalWhere -> `where = 'fornitori.ragioneSociale LIKE "%pasta%"'`
2. `value="pasta fresca"` -> `where = 'fornitori.ragioneSociale LIKE "%pasta%" AND fornitori.ragioneSociale LIKE "%fresca%"'`
3. `value="pasta"`, `additionalWhere="fornitori.attivo = 1"` -> `where = '(fornitori.ragioneSociale LIKE "%pasta%") AND (fornitori.attivo = 1)'`
4. `value=""` -> `where = ""`
5. `value=""`, `additionalWhere="fornitori.attivo = 1"` -> `where = 'fornitori.attivo = 1'` (no parentesi, singolo elemento)
6. `value="  pasta  "` -> trim corretto, stessa uscita del caso 1
7. `modal=true` -> body contiene campi da `options.modal.items`
8. `modal=false/undefined` -> body contiene campi da `options.items`

### Dettaglio test E2E: searchbox.spec.ts

I test E2E richiedono:
- Backend .NET running su `https://0.0.0.0:4000`
- Frontend dev server su `http://localhost:4001`
- Autenticazione tramite lo stesso `auth.setup.ts` (riutilizzato)
- Dati nel database (almeno alcuni fornitori per testare il filtraggio)

Il test naviga a una pagina che contiene un Searchbox (es. la pagina di creazione fattura acquisto o DDT, che ha un searchbox per il fornitore), digita nel campo e verifica i risultati.

## Analisi di Impatto

### Componenti impattati dalla modifica OR -> AND

| Componente | Usa additionalWhere? | Impatto |
|------------|---------------------|---------|
| `fornitoreSearchboxOptions.tsx` | No | Nessuno |
| `utenteSearchboxOptions.tsx` | No | Nessuno |
| `ruoloSearchboxOptions.tsx` | No | Nessuno |
| `menuSearchboxOptions.tsx` | No | Nessuno |
| `fatturaAcquistoSearchboxOptions.tsx` | No | Nessuno |

**Conclusione**: il fix non altera il comportamento di nessun Searchbox attualmente in uso. La modifica e' puramente preventiva/correttiva per usi futuri di `additionalWhere`.

### Rischio di regressione

- **Zero** per i consumatori attuali: nessuno passa `additionalWhere`, quindi il codice modificato (`.join(...)`) non viene mai raggiunto (l'array filtrato ha sempre 1 elemento, e la parenthesizzazione non si applica).
- **Positivo** per usi futuri: qualsiasi configurazione che aggiungera' `additionalWhere` avra' il comportamento corretto (AND) fin da subito.

## Migrazione / Rollout

Nessuna migrazione necessaria. Il fix e' retrocompatibile al 100%.

## Domande Aperte

- [ ] Quale pagina usare per i test E2E? La pagina di creazione DDT (`delivery-notes/new`) o fattura acquisto (`purchases/new`) hanno un Searchbox per il fornitore, ma i path esatti delle route dipendono dalla configurazione menu nel database. Bisogna verificare i path reali sull'app running.
- [ ] Ci sono dati seed sufficienti nel database di sviluppo per testare il filtraggio? Servono almeno 3-4 fornitori con nomi diversi per verificare il restringimento progressivo dei risultati.
