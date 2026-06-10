# Design: Qualità e Manutenibilità — Fase 4

## Technical Approach

Refactor conservativi guidati dalle priorità P0→P3 della proposal, con un vincolo trasversale: **zero modifiche funzionali osservabili**. Le decisioni vincolanti fissate dall'orchestratore sono recepite così:

1. `ExecuteInTransactionAsync` vive su `IUnitOfWork`/`UnitOfWork` (non su un BaseOrchestrator) e gestisce il caso "transazione già aperta" tramite `Context.Database.CurrentTransaction`.
2. ErrorBoundary per-route: **reset su cambio route via prop `resetKey` (pattern resetKeys), NON via `key={location.pathname}`** — il remount forzato cambierebbe comportamento sulle route parametriche (vedi Decisione 2).
3. `useCrudForm<T>` pilota sul solo modulo **fornitori**.
4. Gli smoke test dei 3 componenti pagina si scrivono e si portano a verde **prima** di qualunque refactor P2.
5. P2/P3 sacrificabili; P0/P1 obbligatori.

L'esplorazione del codice reale ha inoltre **corretto due assunzioni della proposal** (documentate nelle Decisioni 3 e 7): la cache Apollo non soffre del clobbering tra variabili diverse ipotizzato da F3 (gli argomenti vivono sui campi figli e Apollo li codifica già nello storeFieldName), e `ChiusuraMensileService` non contiene calcoli aggregati da estrarre (vivono come proprietà calcolate sul model) — si estrae solo il validator.

---

## Architecture Decisions

### Decisione 1: Firma di `ExecuteInTransactionAsync` su IUnitOfWork

**Choice**: due overload su `IUnitOfWork`, implementati in `UnitOfWork`:

```csharp
// backend/Repositories/Interfaces/IUnitOfWork.cs
/// <summary>
/// Esegue <paramref name="operation"/> dentro una transazione esplicita:
/// begin → operation → commit; in caso di eccezione: rollback + rethrow (eccezione originale, non wrappata).
/// Se una transazione è già attiva sul DbContext (CurrentTransaction != null),
/// esegue l'operazione direttamente senza aprirne una nuova (la transazione esterna governa commit/rollback).
/// </summary>
Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> operation);
Task ExecuteInTransactionAsync(Func<Task> operation);
```

```csharp
// backend/Repositories/Implementations/UnitOfWork.cs
public async Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> operation)
{
    if (_context.Database.CurrentTransaction is not null)
    {
        // Transazione ambient già attiva (es. chiamante già in ExecuteInTransactionAsync
        // o transazione raw su Database): non annidare, lascia il controllo al chiamante.
        return await operation();
    }

    await using IDbContextTransaction transaction = await _context.Database.BeginTransactionAsync();
    try
    {
        T result = await operation();
        await transaction.CommitAsync();
        return result;
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}

public async Task ExecuteInTransactionAsync(Func<Task> operation)
    => await ExecuteInTransactionAsync(async () => { await operation(); return true; });
```

**Alternatives considered**:
- *Helper su un `BaseOrchestrator`*: scartato (decisione orchestratore + `SettingsMutations` non è un orchestrator e non erediterebbe).
- *Rilevare l'annidamento con il campo `_transaction` di UnitOfWork*: scartato — `ChiusuraMensileService` e `SettingsMutations` aprono transazioni direttamente su `dbContext.Database`, invisibili al campo. `Database.CurrentTransaction` copre entrambi i mondi (stesso `AppDbContext` scoped condiviso, verificato: `AddScoped<IUnitOfWork, UnitOfWork>` in `Program.cs:90` e GraphQL risolve i servizi dallo stesso scope richiesta).
- *`TransactionScope` / ExecutionStrategy con retry*: scartato — semantica diversa dal boilerplate attuale (la proposal impone replica letterale).

**Rationale**: la semantica replica esattamente il pattern attuale (begin → lavoro → commit; catch → rollback → rethrow, eccezione originale propagata). L'`await using` migliora il dispose rispetto al codice attuale (oggi `_transaction` non viene mai azzerato dopo commit/rollback) senza cambiare il comportamento osservabile. Il check `CurrentTransaction` è insurance a costo zero: oggi **nessun call site è annidato** (verificato: `RegistroCassaSyncService`, chiamato dentro le transazioni di `PagamentoFornitoreOrchestrator` e `DocumentoTrasportoService`, non apre transazioni proprie; le guard `ChiusuraMensileService` in `MutateRegistroCassaOrchestrator` girano PRIMA di `BeginTransactionAsync`).

**Call site adottanti (8 metodi in 7 file)** — tutti con lavoro che produce un risultato, quindi overload generico quasi ovunque:

| Call site | Metodo | Note di adozione |
|---|---|---|
| `MutateRegistroCassaOrchestrator.ExecuteAsync` | `ExecuteInTransactionAsync<RegistroCassa>` | `_eventBus.Publish` resta FUORI dal lambda (dopo il return dell'helper) — invariante "evento dopo commit" preservata |
| `ChiudiRegistroCassaOrchestrator.ExecuteAsync` | overload `void` | eventi fuori dal lambda, guard prima |
| `EliminaRegistroCassaOrchestrator.ExecuteAsync` | `ExecuteInTransactionAsync<bool>` | guard prima |
| `FatturaAcquistoOrchestrator.MutateAsync` | `ExecuteInTransactionAsync<FatturaAcquisto>` | |
| `FatturaAcquistoOrchestrator.AssociaDdtAsync` | `ExecuteInTransactionAsync<FatturaAcquisto>` | |
| `FatturaAcquistoOrchestrator.DisassociaDdtAsync` | `ExecuteInTransactionAsync<FatturaAcquisto>` | |
| `PagamentoFornitoreOrchestrator.MutateAsync` + `EliminaAsync` | generico | |
| `DocumentoTrasportoService.MutateAsync` | `ExecuteInTransactionAsync<DocumentoTrasporto>` | |
| `SettingsMutations` (`creaPeriodo`, riga ~148) | generico | risolve `IUnitOfWork` via `GraphQLService.GetService<IUnitOfWork>(context)`; il lavoro continua a usare `dbContext` (stessa istanza scoped) |

**Fuori scope**: le due transazioni raw di `ChiusuraMensileService` (righe 71, 145) — il service riceve `AppDbContext`, non `IUnitOfWork`; cambiare il ctor toccherebbe DI e i test (`TestDbContextFactory` cita esplicitamente `BeginTransactionAsync` usato dal service). Convivono in sicurezza grazie al check `CurrentTransaction`. I metodi `BeginTransactionAsync`/`Commit`/`Rollback` restano sull'interfaccia (usati dal helper internamente no, ma da eventuali test); il success criterion è zero usi *inline nei call site elencati*.

---

### Decisione 2: ErrorBoundary per-route — `resetKey` prop, non `key={pathname}`

**Choice**: estendere l'`ErrorBoundary` esistente (`duedgusto/src/components/common/ErrorBoundary.tsx`) con props opzionali e creare un piccolo wrapper funzionale `RouteErrorBoundary`:

```tsx
// ErrorBoundary.tsx — props estese (backward-compatible, Root.tsx invariato)
interface ErrorBoundaryProps {
  children: ReactNode;
  /** Variante di rendering del fallback: "fullscreen" (default, attuale) | "inline" (solo area contenuto) */
  variant?: "fullscreen" | "inline";
  /** Quando cambia, l'errore viene resettato (pattern resetKeys di react-error-boundary) */
  resetKey?: string;
}

// Nuovo metodo nella classe:
componentDidUpdate(prevProps: ErrorBoundaryProps) {
  if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }
}
```

```tsx
// routes/RouteErrorBoundary.tsx (nuovo, ~15 righe)
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary variant="inline" resetKey={location.pathname}>
      {children}
    </ErrorBoundary>
  );
}
```

In `ProtectedRoutes.tsx` ogni `element` di pagina diventa:

```tsx
<Suspense fallback={<Fallback />}>
  <RouteErrorBoundary>
    <HomePage />
  </RouteErrorBoundary>
</Suspense>
```

(applicato alle 6 route statiche con componente + al map delle route dinamiche da menu; le route `Navigate`-only non lo richiedono).

Il fallback `inline`: stesso contenuto informativo ma senza `minHeight: "100vh"` (usa `height: "100%"` dentro l'area contenuto del Layout), bottone "Riprova" che fa `this.setState(reset)` (il contenuto si rimonta), bottone "Vai al Dashboard" che usa il **navigator globale** (`src/common/navigator/navigator.tsx`) invece di `window.location.href` — niente full reload, sidebar/header restano vivi. La variante `fullscreen` (Root.tsx) mantiene il comportamento attuale invariato.

**Alternatives considered**:
- *`key={location.pathname}` sul boundary*: scartato. Su route parametriche (`cassa/details/:date`, `cassa/chiusura-mensile/:id`) il pathname cambia ad ogni navigazione prev/next giorno **mentre il componente oggi resta montato** e reagisce via `useParams` + effect (`RegistroCassaDetails` righe 107-117). Il `key` forzerebbe un remount completo (perdita stato griglie, refetch totale) = modifica funzionale vietata.
- *Libreria `react-error-boundary`*: scartato dalla proposal (nessuna dipendenza nuova).
- *`errorElement` dei data router*: l'app usa `<Routes>` dichiarativo dentro `ProtectedRoutes`, non route object con errorElement; ristrutturare il routing è fuori scope.

**Rationale**: `resetKey` resetta SOLO lo stato di errore al cambio pathname senza toccare il ciclo di vita dei figli quando non c'è errore (il boundary renderizza `this.props.children` passthrough). Costo a runtime ~zero; il boundary top-level di `Root.tsx` resta come ultima rete (signature invariata: le nuove props sono opzionali).

---

### Decisione 3: Apollo type policies — mappa reale campo→argomenti e fix

**Analisi delle query reali** (tutte le occorrenze in `src/graphql/**` verificate):

| Campo Query | Argomenti sul campo stesso | Campi figli e loro argomenti discriminanti |
|---|---|---|
| `connection` | **NESSUNO** (namespace puro) | `registriCassa(first,where,orderBy,after)`, `fornitori(first,where,orderBy,cursor)`, `fattureAcquisto(...)`, `documentiTrasporto(...)`, `pagamentiFornitori(...)` + query generate da `useQueryParams` |
| `gestioneCassa` | **NESSUNO** | `denominazioni` (no args), `registroCassa(data)`, `dashboardKPIs` (no args), `riepilogoMensile(anno,mese)`, `fattureNonPagatePerFornitore(fornitoreId)`, `ddtNonPagatiPerFornitore(fornitoreId)` |
| `chiusureMensili` | **NESSUNO** | `chiusureMensili(anno)`, `chiusuraMensile(chiusuraId)`, `validaCompletezzaRegistri(anno,mese)` |

**Correzione del finding F3**: i tre campi sono *namespace fields senza argomenti*. `keyArgs: false` su un campo senza argomenti è equivalente al default: **non esiste il clobbering tra variabili diverse ipotizzato dall'audit**, perché gli argomenti discriminanti stanno sui campi FIGLI e Apollo li serializza automaticamente nello storeFieldName dell'oggetto embedded (es. `registroCassa({"data":"2026-06-01..."})` e `registroCassa({"data":"2026-06-02..."})` sono chiavi distinte dentro la stessa entry `gestioneCassa`). Il problema reale e residuo è il **merge shallow hand-rolled**, che è una reimplementazione fragile di ciò che Apollo offre nativamente.

**Choice**:

```tsx
Query: {
  fields: {
    // Namespace fields senza argomenti: gli argomenti discriminanti vivono sui campi figli
    // e Apollo li codifica nello storeFieldName (es. registroCassa({"data":...})).
    // merge: true = mergeObjects built-in: preserva i sibling arg-keyed esistenti
    // quando una query successiva seleziona solo un sottoinsieme dei figli.
    connection: { merge: true },
    gestioneCassa: { merge: true },
    chiusureMensili: { merge: true },
    settings: { merge: true }, // stesso pattern namespace (GET_BUSINESS_SETTINGS): oggi senza policy → warning/replace al refetch
  },
},
```

- `keyArgs` viene **rimosso** (default = tutti gli argomenti; i campi non ne hanno, quindi nessun cambiamento di chiave cache). I campi figli mantengono il default Apollo (tutti gli argomenti nel keyArgs implicito), che è già corretto.
- **Paginazione Relay**: verificato che NESSUN call site usa `fetchMore` (grep: zero occorrenze produzione). La concatenazione pagine avviene in `useFetchData` nello **stato React** (`setItems(prev => [...prev, ...newItems])`), non nella cache: l'argomento `after`/`cursor` fa parte dello storeFieldName del figlio, quindi ogni pagina è una entry separata in cache — il merge NON deve concatenare, e `merge: true` non concatena. Comportamento di loadMore invariato.
- Rollback per singolo campo possibile (ogni riga è indipendente).

**Alternatives considered**:
- *keyArgs espliciti sui campi figli* (es. `registroCassa: { keyArgs: ["data"] }` dentro una typePolicy del tipo namespace): superfluo — è già il default; aggiunge solo manutenzione.
- *Mantenere i merge custom `{...existing, ...incoming}`*: funzionalmente quasi identico a `mergeObjects` ma perde le ottimizzazioni/warning di Apollo e ha indotto il finding F3; sostituirlo con `merge: true` documenta l'intento.
- *Normalizzare i namespace con keyFields finti*: invasivo e senza beneficio.

**Verifica manuale richiesta** (come da proposal): flussi cassa (cambio giorno prev/next, vista mensile, dashboard KPI), chiusure mensili (lista per anno + dettaglio), fornitori (liste paginate con filtro). Atteso: nessuna differenza visibile, sparizione di eventuali warning "cache data may be lost".

---

### Decisione 4: Fix `useFetchData` (3 bug, comportamento esterno conservato)

**Choice** (`src/graphql/common/useFetchData.tsx`):

1. **fetchPolicy (riga 40)**: `fetchItems` usa il parametro `fetchPolicy` invece di `"cache-first"` hardcoded. **Censimento call site: `fetchItems` non ha NESSUN consumer di produzione** (solo i test del hook; l'unico consumer di `useFetchData` è `Searchbox.tsx` che usa `items`/`loading`). Rischio: zero. Nota: `client.query` accetta `FetchPolicy` (senza `cache-and-network`); il parametro del hook è `WatchQueryFetchPolicy` — nel fix si passa il valore con narrowing esplicito (`fetchPolicy === "cache-and-network" ? "cache-first" : fetchPolicy`) oppure si tipizza il parametro come `FetchPolicy`: si sceglie il narrowing per non toccare la firma pubblica.
2. **`fetchingMore` (righe 168-181)**: aggiungere `setFetchingMore(false)` nel ramo `next` di `subscribeToMore` prima della `resolve` (oggi solo il ramo `error` lo fa). Anche qui zero consumer di produzione di `subscribeToMore`/`fetchingMore` — fix di correttezza per usi futuri.
3. **Lifecycle subscription (effetto righe 57-119)**: il cleanup dell'effetto oggi fa solo `clearTimeout`. Fix: il cleanup fa anche unsubscribe della subscription corrente:

```tsx
useEffect(() => {
  const debouncedFetch = setTimeout(() => { /* ... invariato ... */ }, 300);
  return () => {
    clearTimeout(debouncedFetch);
    firstPageSubscription.current?.unsubscribe();
    firstPageSubscription.current = null;
  };
}, [skip, query, variables, client, fetchPolicy, reverseGrid]);
```

L'unsubscribe difensivo a inizio effetto (righe 58-61) diventa ridondante e si rimuove; l'effetto unmount-only (righe 45-55) resta per `loadMoreSubscription` (e può perdere il ramo firstPage, ormai coperto dal cleanup). Il guard `thisRequest !== requestId.current` resta come seconda difesa.

**Rationale**: i test esistenti (`useFetchData.test.tsx`, 10+ casi) fanno da harness; il fix elimina subscription orfane tra run consecutive (oggi una run B partita durante il debounce di A lasciava viva la subscription di A fino alla run successiva).

---

### Decisione 5: Sync settings Apollo→Zustand unificata

**Stato attuale (4 percorsi divergenti)**: parsing inline in `SettingsDetails.onCompleted` (non usa `parseSettingsFromRaw`); `readQuery as any` in `GiorniNonLavorativiSection.syncStoreFromCache`; refetch-only in `PeriodoProgrammazioneSection` (che si appoggia agli effect del padre, ma SOLO per periodi/giorni — il commento in `onCompleted` riga 73-78 è dead logic); `useSettingsSync` (subscription) che rifà la query network-only e usa `parseSettingsFromRaw`.

**Choice**: un solo punto di scrittura dello store, basato sul fatto che `SettingsDetails` osserva già `GET_BUSINESS_SETTINGS` via `useQuery` (in `useGetBusinessSettings`): ogni refetch della query aggiorna `data` → un unico effect sincronizza lo store.

1. **`parseSettingsFromRaw` tipizzato** (`src/graphql/settings/parseSettingsFromRaw.tsx`): nuovo tipo input esportato che modella la shape della query:

```tsx
export interface RawBusinessSettings {
  settingsId: number; businessName: string;
  openingTime?: string | null; closingTime?: string | null;
  operatingDays: string | boolean[];
  timezone: string; currency: string; vatRate: number;
  updatedAt?: string; createdAt?: string;
}
export interface RawPeriodoProgrammazione { periodoId: number; dataInizio: string; dataFine: string | null; giorniOperativi: string | boolean[]; orarioApertura?: string | null; orarioChiusura?: string | null; }
export interface RawSettingsData {
  businessSettings?: RawBusinessSettings | null;
  periodiProgrammazione?: RawPeriodoProgrammazione[] | null;
  giorniNonLavorativi?: GiornoNonLavorativo[] | null;
}
export function parseSettingsFromRaw(rawData: RawSettingsData | null | undefined): { settings: BusinessSettings | null; periodi: PeriodoProgrammazione[]; giorniNonLavorativi: GiornoNonLavorativo[] }
```

   (rimuove i 3 `eslint-disable no-explicit-any` del file; `parseOperatingDays` accetta `string | boolean[]`).

2. **Nuovo hook `useSyncSettingsToStore`** (`src/graphql/settings/useSyncSettingsToStore.tsx`): unico writer dello store:

```tsx
function useSyncSettingsToStore() {
  const setSettings = useStore((s) => s.setSettings);
  const setPeriodi = useStore((s) => s.setPeriodi);
  const setGiorniNonLavorativi = useStore((s) => s.setGiorniNonLavorativi);
  return useCallback((raw: RawSettingsData | null | undefined) => {
    const parsed = parseSettingsFromRaw(raw);
    if (parsed.settings) setSettings(parsed.settings);
    setPeriodi(parsed.periodi);
    setGiorniNonLavorativi(parsed.giorniNonLavorativi);
  }, [setSettings, setPeriodi, setGiorniNonLavorativi]);
}
```

3. **Adozione**:
   - `useGetBusinessSettings`: i tre `useMemo` di parsing delegano a `parseSettingsFromRaw(data?.settings)` (un solo memo) — elimina la terza copia del parsing; firma di ritorno invariata. Espone anche `rawSettings: data?.settings` per il punto seguente.
   - `SettingsDetails`: i due effect `setPeriodi`/`setGiorniNonLavorativi` + il `setSettings` manuale in `onCompleted` vengono sostituiti da UN effect: `useEffect(() => { if (rawSettings) syncToStore(rawSettings); }, [rawSettings, syncToStore])`. La mutation `UPDATE_BUSINESS_SETTINGS` aggiunge `refetchQueries: [{ query: GET_BUSINESS_SETTINGS }], awaitRefetchQueries: true` (oggi il risultato mutation non aggiorna la cache della query, essendo namespace non normalizzato); `onCompleted` conserva SOLO la re-init del form (`handleInitializeValues(parseSettingsFromRaw({ businessSettings: updated }).settings!)`) + toast.
   - `GiorniNonLavorativiSection`: elimina `syncStoreFromCache`/`readQuery as any` e `useApolloClient` — le 3 mutation mantengono `refetchQueries + awaitRefetchQueries`; il refetch aggiorna `data` del padre → l'effect unico sincronizza. `onCompleted` resta per toast/chiusura dialog.
   - `PeriodoProgrammazioneSection`: aggiunge `awaitRefetchQueries: true` alle 3 mutation (oggi assente: lo store si aggiornava "quando capita"); rimuove il commento/dead logic in `creaPeriodo.onCompleted`. Nessun'altra modifica.
   - `useSettingsSync` (subscription, montato in Layout): mantiene la query `network-only` ma sostituisce le tre chiamate `set*` con `syncToStore(result.data?.settings)`.

**Alternatives considered**: helper non-hook `syncSettingsToStore(raw)` che usa `useStore.getState()` — funziona anche fuori da React, ma il pattern del progetto (slice + selector) preferisce hook; la subscription e i componenti sono tutti in React. Scelto hook + callback.

**Rationale**: dopo OGNI mutation settings il flusso è identico: mutation → refetch GET_BUSINESS_SETTINGS (awaited) → `data` aggiornato → effect unico → `parseSettingsFromRaw` → store. `isOpen()`/`getNextOperatingDate()` leggono dati freschi senza reload. Un solo punto di parsing, zero `as any`.

---

### Decisione 6: `businessSettingsStore` — tipizzazione `set`

**Choice**: allineare la firma alla convenzione Zustand degli altri slice:

```tsx
import { StoreApi } from "zustand";

function businessSettingsStore(
  set: StoreApi<Store>["setState"],
  get: StoreApi<Store>["getState"],
): BusinessSettingsStoreState
```

I body `set((state: Store) => ({ ...state, settings }))` restano validi (si possono semplificare in `set({ settings })` ma NON si fa: refactor a costo non-zero, fuori dal vincolo conservativo). Rimosso l'`eslint-disable` riga 32. Verificare in `useStore.tsx` come gli altri slice tipizzano `set` e usare lo stesso pattern (coerenza > eleganza).

---

### Decisione 7: Scomposizione `ChiusuraMensileService` (662 righe) — solo Validator

**Correzione del finding F6**: i "calcoli aggregati" citati dalla proposal non vivono nel service — `RicavoTotaleCalcolato` & co. sono proprietà calcolate sul model `ChiusuraMensile`. Il service contiene: CRUD/transizioni di stato (righe 30-465) + blocco validazione completezza (476-661). **Si estrae solo il validator; nessun calculator** (creare una classe vuota per fede al testo della proposal sarebbe gold-plating).

**Choice**: nuova classe `ChiusuraMensileValidator` (`backend/Services/ChiusureMensili/ChiusuraMensileValidator.cs`), registrata in DI (`AddScoped`), ctor `(AppDbContext)`:

- `Task<List<DateTime>> ValidaCompletezzaRegistriAsync(int anno, int mese)` — spostamento letterale del corpo attuale;
- `private ElencoGiorniMancanti(...)` e `private ElencoGiorniMancantiPerPeriodo(...)` — spostamento letterale;
- `Task<bool> IsGiornoOperativoAsync(DateTime data)` *(opzionale, solo se a costo zero)*: la logica periodo+operatingDayIndex duplicata in `AggiornaGiorniEsclusiAsync` (righe 410-435) — se l'estrazione richiede di cambiare la struttura del loop, NON farla in questa fase.

`ChiusuraMensileService` riceve il validator nel ctor e **delega**: `public Task<List<DateTime>> ValidaCompletezzaRegistriAsync(int anno, int mese) => _validator.ValidaCompletezzaRegistriAsync(anno, mese);`. **API pubblica del service invariata** (firma e semantica): i call site GraphQL (`ChiusureMensiliQueries`, guards, orchestrator) non si toccano. Aggiornare la registrazione DI in `Program.cs` e il setup dei test che istanziano il service direttamente (cercare `new ChiusuraMensileService(` in `DuedGusto.Tests`).

---

### Decisione 8: `useCrudForm<T>` — API e pilota fornitori

**Intersezione reale dei 16 `useInitializeValues`** (verificata su fornitori, settings; struttura identica): default values factory → `useState(initialValues)` → `handleInitializeValues(values?)` = `mergeWithDefaults(values, prev)` + `setInitialFocus()` se `!values` → effect one-shot con `initialized.current` e `skipInitialize`. I 21 `setInitialFocus` sono tutti `document.getElementsByName(NOME_CAMPO)[0].focus()`.

**Choice** (`src/components/common/form/useCrudForm.tsx`):

```tsx
interface UseCrudFormOptions<T extends object> {
  /** Valori di default del form (factory per evitare condivisione di referenze) */
  defaultValues: () => T;
  /** Se true, salta l'inizializzazione automatica al mount (es. valori che arrivano dal padre) */
  skipInitialize?: boolean;
  /** Campo che riceve il focus iniziale (sostituisce i setInitialFocus.tsx per-modulo) */
  focusFieldName?: string;
}

interface UseCrudFormResult<T extends object> {
  initialValues: T;
  /** Merge parziale sui default; senza argomenti riporta ai default e rimette il focus */
  handleInitializeValues: (values?: Partial<T>) => Promise<boolean>;
  /** Focus programmatico sul campo focusFieldName (per i reset post-conferma) */
  setInitialFocus: () => void;
}

function useCrudForm<T extends object>(options: UseCrudFormOptions<T>): UseCrudFormResult<T>
```

Implementazione = lift letterale del corpo di `fornitori/useInitializeValues.tsx` con `setInitialFocus` generalizzato:

```tsx
const setInitialFocus = useCallback(() => {
  if (!focusFieldName) return;
  const [el] = window.document.getElementsByName(focusFieldName);
  el?.focus();
}, [focusFieldName]);
```

**Pilota**: `FornitoreFormContainer.tsx` sostituisce `useInitializeValues({ skipInitialize })` + import `setInitialFocus` con:

```tsx
const { initialValues, handleInitializeValues, setInitialFocus } = useCrudForm<FormikFornitoreValues>({
  defaultValues: getDefaultFornitoreValues, // spostata in fornitoreFormSchema.tsx
  skipInitialize: props.mode === "page" && !!props.initialFornitoreValues,
  focusFieldName: "ragioneSociale",
});
```

File eliminati: `fornitori/useInitializeValues.tsx`, `fornitori/setInitialFocus.tsx`. Gli altri 15 moduli **non si toccano**. Lo status/lock del form (`formStatuses` + `setStatus` post-init) NON entra nell'hook in questa fase: i call site lo gestiscono in modi leggermente diversi (setTimeout vs then) e assorbirlo ora violerebbe il vincolo conservativo — annotato come evoluzione per il rollout futuro.

**Perché fornitori e non users**: pattern completo (page+modal mode, search, reset, focus) ma form semplice senza grid; 715 righe totali; già verificato dalla proposal.

---

### Decisione 9: Estrazione hook conservativa da RegistroCassaDetails / MonthlyClosureDetails

**`useRegistroCassaSubscriptions`** (`src/graphql/subscriptions/useRegistroCassaSubscriptions.tsx`, nuovo): lift letterale delle 3 coppie subscription+effect (righe 132-167 di `RegistroCassaDetails.tsx` — pattern identico: "se `event.registroCassaId === cashRegister.id` → `refetchCashRegister()`"):

```tsx
interface UseRegistroCassaSubscriptionsOptions {
  cashRegisterId: number | undefined; // cashRegister?.id
  refetch: () => void;
}
function useRegistroCassaSubscriptions({ cashRegisterId, refetch }: UseRegistroCassaSubscriptionsOptions): void
```

Internamente: i 3 hook subscription esistenti (`useRegistroCassaSubscription`, `useVenditaCreatedSubscription`, `useChiusuraCassaSubscription`) + 3 effect identici a oggi, con guard `cashRegisterId != null`. NOTA dipendenze: oggi gli effect dipendono da `cashRegister` (oggetto) ma usano solo `.id` — passare l'id primitivo è equivalente per il confronto e riduce le run dell'effect; comportamento osservabile invariato (il refetch scatta nelle stesse condizioni). Il consolidamento dei 4 `useState` `initial*` si fa SOLO se il diff resta meccanico (stato unico `{openingCounts, closingCounts, incomes, expenses}` con un solo setter); se tocca più di `RegistroCassaDetails`, si rinuncia.

**`MonthlyClosureDetails`** (945 righe, NESSUNA subscription — verificato): blocchi auto-contenuti estraibili senza toccare il render:
- `useAutoCreaChiusura({ isNewMode, anno, mese, creaChiusura, navigate })` → lift dell'effect righe 166-188 + `autoCreateInitiated` ref + stato `autoCreateError` (ritornato);
- `useGiorniEsclusi({ chiusuraMensile, giorniMancanti })` → lift delle derivazioni `giorniEsclusiParsed`/`giorniEsclusiSet`/`giorniEffettivamenteMancanti` + stato `esclusioniLocali` + effect righe 136-152 (ritorna anche `setEsclusioniLocali`, `hasRegistriMancanti`, `hasGiorniDaGestire`).

Entrambi in `src/components/pages/registrazioneCassa/` (hook locali al modulo, come `useCashCountData`). Nessuna scomposizione in sotto-componenti.

---

### Decisione 10: Smoke test PRIMA dei refactor P2 (ordine vincolante)

**Pattern**: si segue il pattern consolidato di `ProfilePage.test.tsx` — `vi.mock` dei moduli hook GraphQL/store (NON `MockedProvider`: i componenti usano hook custom, subscription WS e AG Grid che renderebbero il MockedProvider fragile) + `DataRouterTestWrapper` per il router.

| Componente | Mock necessari | Asserzioni smoke |
|---|---|---|
| `RegistroCassaDetails` | `useQueryDenominations`, `useQueryCashRegister`, `useSubmitCashRegister`, `useCloseCashRegister`, le 3 subscription (`useRegistroCassaSubscription` ecc. → `{ data: undefined }`), `useStore` (utente, `isOpen`, `getNextOperatingDate`), `CashRegisterFormDataGrid` (stub leggero — AG Grid Enterprise non gira in jsdom in modo affidabile), `useInitializeValues` NO (reale) | monta senza errori su route `/gestionale/cassa/details/2026-06-10`; mostra data formattata/toolbar; `setTitle` chiamato |
| `MonthlyClosureDetails` | `useQueryChiusuraMensile`, `useQueryValidaCompletezzaRegistri`, le 7 mutation via mock `useMutation` (pattern ProfilePage), componenti griglia stub | monta in modalità esistente (`:id`) con chiusura BOZZA mock; titolo "Chiusura Mensile - …"; sezioni chiave visibili |
| `FatturaAcquistoDetails` | hook GraphQL del modulo fattureAcquisto, store, eventuali grid stub | monta senza errori; elementi chiave del form presenti |

Percorsi: `src/components/pages/registrazioneCassa/__tests__/RegistroCassaDetails.test.tsx`, `.../MonthlyClosureDetails.test.tsx`, `src/components/pages/fattureAcquisto/__tests__/FatturaAcquistoDetails.test.tsx`. Questi test si scrivono nella **Fase 3 (prima riga)** e DEVONO essere verdi prima di iniziare Decisioni 8-9; dopo ogni estrazione hook si rieseguono invariati (i mock dei moduli subscription continuano a funzionare perché il nuovo hook composito importa gli stessi moduli mockati).

---

### Decisione 11: Tipizzazione bones + ARIA (P3)

**bones** (`src/common/bones/`): generics al posto di `any`, vincolo "nessun cast nei call site":
- `debounce.tsx`: `function debounce<TArgs extends unknown[], TReturn>(func: (...args: TArgs) => TReturn, wait: number)` — `this` tipizzato `unknown`; il tipo ritorno `((...args: TArgs) => Promise<Awaited<TReturn>>) & { cancel: () => void }`.
- `omitDeep.tsx`: `function omitDeep<T>(value: T, omitArrayProperties?: string[]): T` con helper interni su `unknown` + narrowing (`Array.isArray`, type predicate per record). Il contratto runtime (rimozione chiavi ricorsiva) non è esprimibile esattamente nel tipo: si dichiara `T` in/out (uso reale: pulizia `__typename` prima delle mutation — i chiamanti già trattano il risultato come lo stesso tipo).
- `differenceBy.tsx`: `function differenceBy<T, K>(arr1: T[], arr2: T[], keyOrIteratee: keyof T | ((item: T) => K)): T[]`.
- `isEqual`, `unionBy`, `uniq`, `PromiseQueue`: stesso approccio (generic + `unknown` interno); da verificare file per file in fase apply con `ts:check` come gate.

**ARIA**: censimento in fase apply con grep `<IconButton` nei file componente; per ogni IconButton senza testo né `aria-label` si aggiunge `aria-label` italiano descrittivo (es. `aria-label="Modifica"`, `aria-label="Elimina"`, `aria-label="Giorno precedente"`). Nei casi con `title` già presente (es. `GiorniNonLavorativiSection`) l'`aria-label` duplica il `title`. Nessun cambiamento visivo.

---

## Data Flow

### Sync settings unificata (dopo)

```
mutation (update/crea/aggiorna/elimina, qualsiasi sezione)
   │  refetchQueries: [GET_BUSINESS_SETTINGS], awaitRefetchQueries: true
   ▼
Apollo cache (Query.settings, merge: true)
   │  useQuery(GET_BUSINESS_SETTINGS) in useGetBusinessSettings → data aggiornato
   ▼
SettingsDetails: useEffect(rawSettings) ──► useSyncSettingsToStore ──► parseSettingsFromRaw ──► Zustand
                                                       ▲
useSettingsSync (subscription, Layout) ── query network-only ┘

Consumatori: isOpen() / getNextOperatingDate() / calendario — sempre freschi, zero reload
```

### Transazioni backend (dopo)

```
Resolver GraphQL ──► Orchestrator/Service
                        │
                        ▼
            IUnitOfWork.ExecuteInTransactionAsync(async () => { ...lavoro... return result; })
                        │  CurrentTransaction != null? → esegui direttamente (ambient)
                        │  altrimenti: begin → op → commit / catch → rollback → rethrow
                        ▼
            eventi EventBus pubblicati DOPO (fuori dal lambda)
```

---

## File Changes

| File | Action | Descrizione |
|------|--------|-------------|
| **P0** | | |
| `duedgusto/src/components/common/ErrorBoundary.tsx` | Modify | Props `variant`/`resetKey`, `componentDidUpdate` reset, fallback inline, navigator invece di `window.location.href` nella variante inline |
| `duedgusto/src/routes/RouteErrorBoundary.tsx` | Create | Wrapper `useLocation` → `resetKey={pathname}` |
| `duedgusto/src/routes/ProtectedRoutes.tsx` | Modify | `RouteErrorBoundary` attorno ai 6 elementi statici + route dinamiche da menu |
| `duedgusto/src/graphql/common/useFetchData.tsx` | Modify | fetchPolicy param rispettato, `setFetchingMore(false)` su success, unsubscribe nel cleanup dell'effetto |
| `duedgusto/src/graphql/configureClient.tsx` | Modify | `connection`/`gestioneCassa`/`chiusureMensili`/`settings` → `{ merge: true }`, rimozione keyArgs:false e merge custom |
| **P1** | | |
| `duedgusto/src/graphql/settings/parseSettingsFromRaw.tsx` | Modify | Tipi `RawSettingsData` ecc., zero `any` |
| `duedgusto/src/graphql/settings/useSyncSettingsToStore.tsx` | Create | Unico writer Apollo→Zustand |
| `duedgusto/src/graphql/settings/useGetBusinessSettings.tsx` | Modify | Delega parsing a `parseSettingsFromRaw`, espone `rawSettings` |
| `duedgusto/src/components/pages/settings/SettingsDetails.tsx` | Modify | Effect unico di sync, mutation con refetchQueries awaited, onCompleted senza parsing inline |
| `duedgusto/src/components/pages/settings/GiorniNonLavorativiSection.tsx` | Modify | Rimozione `syncStoreFromCache`/`readQuery as any` |
| `duedgusto/src/components/pages/settings/PeriodoProgrammazioneSection.tsx` | Modify | `awaitRefetchQueries: true`, rimozione dead logic |
| `duedgusto/src/graphql/subscriptions/useSettingsSync.tsx` | Modify | Usa `useSyncSettingsToStore` |
| `backend/Repositories/Interfaces/IUnitOfWork.cs` | Modify | + 2 overload `ExecuteInTransactionAsync` |
| `backend/Repositories/Implementations/UnitOfWork.cs` | Modify | Implementazione con check `CurrentTransaction` |
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modify | Adozione helper (eventi fuori dal lambda) |
| `backend/GraphQL/GestioneCassa/ChiudiRegistroCassaOrchestrator.cs` | Modify | Adozione helper |
| `backend/GraphQL/GestioneCassa/EliminaRegistroCassaOrchestrator.cs` | Modify | Adozione helper |
| `backend/GraphQL/Fornitori/FatturaAcquistoOrchestrator.cs` | Modify | Adozione helper (3 metodi) |
| `backend/GraphQL/Fornitori/PagamentoFornitoreOrchestrator.cs` | Modify | Adozione helper (2 metodi) |
| `backend/GraphQL/Fornitori/DocumentoTrasportoService.cs` | Modify | Adozione helper |
| `backend/GraphQL/Settings/SettingsMutations.cs` | Modify | `creaPeriodo` via `GetService<IUnitOfWork>` + helper |
| **P2** (dopo smoke test) | | |
| `duedgusto/src/components/pages/registrazioneCassa/__tests__/RegistroCassaDetails.test.tsx` | Create | Smoke test (PRIMA dei refactor) |
| `duedgusto/src/components/pages/registrazioneCassa/__tests__/MonthlyClosureDetails.test.tsx` | Create | Smoke test (PRIMA dei refactor) |
| `duedgusto/src/components/pages/fattureAcquisto/__tests__/FatturaAcquistoDetails.test.tsx` | Create | Smoke test |
| `duedgusto/src/graphql/subscriptions/useRegistroCassaSubscriptions.tsx` | Create | Hook composito 3 subscription |
| `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | Modify | Usa hook estratto; consolidamento `initial*` solo se a costo zero |
| `duedgusto/src/components/pages/registrazioneCassa/useAutoCreaChiusura.tsx` | Create | Lift effect auto-create |
| `duedgusto/src/components/pages/registrazioneCassa/useGiorniEsclusi.tsx` | Create | Lift derivazioni giorni esclusi |
| `duedgusto/src/components/pages/registrazioneCassa/MonthlyClosureDetails.tsx` | Modify | Usa i 2 hook estratti |
| `duedgusto/src/components/common/form/useCrudForm.tsx` | Create | Hook generico (Decisione 8) |
| `duedgusto/src/components/pages/fornitori/FornitoreFormContainer.tsx` | Modify | Pilota useCrudForm |
| `duedgusto/src/components/pages/fornitori/fornitoreFormSchema.tsx` | Modify | + `getDefaultFornitoreValues` |
| `duedgusto/src/components/pages/fornitori/useInitializeValues.tsx` | Delete | Assorbito da useCrudForm |
| `duedgusto/src/components/pages/fornitori/setInitialFocus.tsx` | Delete | Assorbito da useCrudForm |
| `backend/Services/ChiusureMensili/ChiusuraMensileValidator.cs` | Create | Validator estratto (lift letterale) |
| `backend/Services/ChiusureMensili/ChiusuraMensileService.cs` | Modify | Delega al validator, API invariata |
| `backend/Program.cs` | Modify | Registrazione DI validator |
| **P3** | | |
| `duedgusto/src/common/bones/{debounce,omitDeep,differenceBy,isEqual,unionBy,uniq,PromiseQueue}.tsx` | Modify | Generics, zero eslint-disable |
| `duedgusto/src/store/businessSettingsStore.tsx` | Modify | `set: StoreApi<Store>["setState"]` |
| `duedgusto/src/components/**` (~18 file) | Modify | `aria-label` italiani su IconButton |

## Interfaces / Contracts

Definiti inline nelle Decisioni 1 (C#), 2, 5, 8, 9 (TS). Nessuna modifica allo schema GraphQL, nessuna migrazione EF Core.

## Testing Strategy

| Layer | Cosa | Come |
|-------|------|------|
| Unit FE | useFetchData fix (fetchPolicy, fetchingMore, unsubscribe) | Estendere `useFetchData.test.tsx` esistente: spy su `client.query` per la policy; assert unsubscribe chiamato al cambio variables |
| Unit FE | ErrorBoundary `resetKey`/`variant` | Estendere il test esistente del boundary: figlio che lancia → fallback inline → cambio resetKey → children ri-renderizzati |
| Unit FE | `parseSettingsFromRaw` tipizzato + `useSyncSettingsToStore` | Test diretti su input raw (stringhe JSON / array) |
| Unit FE | `useCrudForm` | `renderHook`: defaults, merge parziale, skip, focus (jsdom `getElementsByName`) |
| Smoke FE | 3 componenti pagina (PRIMA dei refactor P2) | Pattern ProfilePage: `vi.mock` hook + store, stub grid, `DataRouterTestWrapper` |
| Unit BE | `ExecuteInTransactionAsync` | Test su UnitOfWork: commit su successo, rollback+rethrow su eccezione, passthrough con transazione ambient (SQLite/InMemory come da `TestDbContextFactory`) |
| Regressione BE | 234 test esistenti | `dotnet test` come gate dopo ogni call site migrato |
| Regressione FE | 471 test esistenti | `npm run test` + `ts:check` + `lint` come gate per blocco di priorità |
| Manuale | Cache policies (flussi cassa/chiusure/fornitori), sync settings (isOpen/getNextOperatingDate post-mutation), boundary per-route (errore simulato in una pagina) | Checklist nei Success Criteria della proposal |

## Migration / Rollout

Nessuna migrazione DB, nessun cambio di schema GraphQL. Ordine di implementazione vincolante:

1. **Fase 0 — Baseline**: run completa test BE+FE (riconferma 234/471 verdi).
2. **Fase 1 — P0**: ErrorBoundary per-route → useFetchData → cache policies (ultimo perché richiede verifica manuale). Gate FE.
3. **Fase 2 — P1**: backend `ExecuteInTransactionAsync` + adozione call site per call site (commit atomici) → sync settings. Gate BE+FE.
4. **Fase 3 — P2**: PRIMA gli smoke test dei 3 componenti (P3.12 anticipato) → poi `useRegistroCassaSubscriptions` → hook MonthlyClosure → `useCrudForm` pilota fornitori → `ChiusuraMensileValidator`. Gate dopo ogni estrazione.
5. **Fase 4 — P3**: bones generics → businessSettingsStore/parseSettings residui → aria-label. Gate finale completo.

Rollback: per blocco di priorità (commit separati); cache policies rollbackabili per singolo campo; helper transazionale rollbackabile per singolo call site.

## Open Questions

- [ ] `isEqual`/`unionBy`/`uniq`/`PromiseQueue` non sono stati ispezionati riga per riga in fase design: la tipizzazione segue l'approccio della Decisione 11, ma l'elenco esatto delle firme si finalizza in apply con `ts:check` come arbitro (rischio basso, item P3 sacrificabile).
- [ ] Consolidamento dei 4 `useState` `initial*` di RegistroCassaDetails: condizionato a "diff meccanico, costo zero" — decisione finale in apply, default = NON fare.
- [ ] `FatturaAcquistoDetails`: struttura non ispezionata in dettaglio; se il componente è una shell sottile sul pattern container (come FornitoreDetails), lo smoke test è banale; in caso contrario lo stub dei figli grid segue il pattern di RegistroCassaDetails.
