# Design: Searchbox UX Improvements

## Technical Approach

Quattro miglioramenti indipendenti al modulo Searchbox, tutti confinati ai file in `src/components/common/form/searchbox/` e `src/@types/searchbox.d.ts`. Nessuna modifica al backend, al Datagrid base, o ad altri componenti. Ogni improvement puo' essere implementato e testato separatamente.

Scoperta importante durante l'analisi: `useFetchData` (riga 62) contiene gia' un `setTimeout(..., 300)` interno che funge da debounce sulla fetch. Il debounce nel Searchbox servira' quindi a ridurre le ri-renderizzazioni e le ri-computazioni di `useSearchboxQueryParams`, non a sostituire quello esistente in `useFetchData`.

## Architecture Decisions

### Decision: Debounce con useEffect+setTimeout invece di bones/debounce

**Choice**: Usare il pattern `useEffect` + `setTimeout` + cleanup per creare un `debouncedValue` locale nel componente Searchbox.

**Alternatives considered**:
1. `src/common/bones/debounce.tsx` — utility imperativa che restituisce una Promise. Non si adatta al flusso dichiarativo React (stato + effetti). Richiederebbe un wrapper `useDebouncedCallback` custom.
2. Hook custom `useDebounce(value, delay)` — possibile ma over-engineering per un singolo utilizzo.

**Rationale**: Il pattern useEffect+setTimeout e' il piu' semplice, idiomatico in React, e gia' usato nel progetto (vedi `ContainerGridResults.tsx` riga 28 e `useFetchData.tsx` riga 62). Non richiede nuovi file o utility. Il cleanup su unmount e cambio valore e' garantito dalla return function dell'useEffect.

### Decision: Rimuovere il Paper "Nessun risultato" e usare AG Grid overlayNoRowsTemplate

**Choice**: Rimuovere il branch condizionale (righe 214-234 di `Searchbox.tsx`) e renderizzare sempre `ContainerGridResults`. Configurare `overlayNoRowsTemplate` su AgGrid in `GridResults.tsx` per mostrare il messaggio empty-state.

**Alternatives considered**:
1. `noRowsOverlayComponent` custom — piu' flessibile ma richiede un componente React aggiuntivo, over-engineering per un semplice messaggio di testo.
2. Mantenere il Paper ma dentro `ContainerGridResults` — rompe la separazione di responsabilita' (il container non deve decidere cosa mostrare in base ai dati).

**Rationale**: AG Grid gestisce nativamente lo stato "nessuna riga" tramite `overlayNoRowsTemplate`. E' una stringa HTML semplice, coerente con il messaggio originale "Nessun risultato trovato". Eliminando il branch condizionale si semplifica il JSX di Searchbox e la griglia resta sempre montata (stabile per focus/navigazione).

### Decision: Arrow Up handler tramite onCellKeyDown esistente

**Choice**: Estendere l'handler `handleCellKeyDown` gia' presente in `GridResults.tsx` per intercettare `ArrowUp` quando `rowIndex === 0`. Propagare un callback `onNavigateBack` attraverso la catena `Searchbox -> ContainerGridResults -> GridResults`.

**Alternatives considered**:
1. `suppressKeyboardEvent` su AG Grid — piu' invasivo, intercetta PRIMA di AG Grid, rischio di rompere la navigazione interna della griglia.
2. Event listener globale sul container div — fragile, richiede gestione focus manuale.

**Rationale**: `onCellKeyDown` e' gia' usato per intercettare Enter nella griglia. Aggiungere ArrowUp e' consistente con il pattern esistente. AG Grid processa prima la navigazione interna, poi chiama `onCellKeyDown` — quindi alla riga 0 Arrow Up non fa nulla in AG Grid (nessuna riga sopra), e il nostro handler puo' intervenire senza conflitti.

### Decision: Rename DatagridColDef -> SearchboxColDef con conversione interna

**Choice**: Rinominare `DatagridColDef` in `searchbox.d.ts` a `SearchboxColDef<T>` basato su `ColDef<T>` (non `ColDef<DatagridData<T>>`). `GridResults` e `SearchboxModal` ricevono `SearchboxColDef<T>[]` e fanno internamente il mapping a `ColDef<DatagridData<T>>[]`.

**Alternatives considered**:
1. Mantenere il nome `DatagridColDef` e aggiungere un generic per distinguerlo — confuso perche' esiste gia' `DatagridColDef` in `Datagrid.d.ts` con semantica diversa.
2. Fare il wrapping al livello di `Searchbox.tsx` — sposta la responsabilita' troppo in alto, e i componenti interni non sarebbero type-safe.

**Rationale**: Il conflitto di naming tra `DatagridColDef` in `searchbox.d.ts` (basato su `ColDef<T>`) e `DatagridColDef` in `Datagrid.d.ts` (basato su `ColDef<DatagridData<T>>`) e' la causa root dei cast `as any`. Rinominando a `SearchboxColDef<T>` si elimina l'ambiguita'. Il campo `graphField` non e' mai usato nel codice (solo dichiarato nel tipo), ma lo manteniamo per futura estensibilita'. Il campo `action` pure non e' usato — idem.

## Data Flow

### Debounce Flow

```
User types
    │
    v
handleInputChange() ──> setInnerValue(newValue)   [immediato, UI reattiva]
                         onChange(name, newValue)
                         setResultsVisible(true)
    │
    v
useEffect([innerValue]) ──> setTimeout(300ms) ──> setDebouncedValue(innerValue)
    │                            │
    │  (cleanup on re-type)      │
    │  clearTimeout(prev)        │
    v                            v
                          useSearchboxQueryParams({ value: debouncedValue })
                                 │
                                 v
                          useFetchData({ skip: debouncedValue.trim().length < 3 })
                                 │
                                 v  (useFetchData ha un suo debounce interno di 300ms)
                          Apollo Client query
```

### Arrow Up Navigation Flow

```
User presses ArrowUp in grid (rowIndex === 0)
    │
    v
handleCellKeyDown(params)
    │
    ├── params.event.key === "ArrowUp"
    │   params.rowIndex === 0
    │
    v
onNavigateBack()  ←── callback prop from Searchbox
    │
    v
inputRef.current.focus()
params.api.deselectAll()
```

### Type Flow (after cleanup)

```
searchboxOptions files
    │
    │  definiscono: SearchboxColDef<T>[]
    │  (basato su ColDef<T> + graphField + action)
    │
    v
SearchboxOptions<T>.items / .modal.items
    │
    v
Searchbox.tsx ──> passa SearchboxColDef<T>[] a ContainerGridResults e SearchboxModal
    │
    ├── ContainerGridResults ──> GridResults
    │       │
    │       v
    │   wrappedColumnDefs: ColDef<DatagridData<T>>[]  (mapping interno, type-safe)
    │       │
    │       v
    │   AgGrid<T> columnDefs={wrappedColumnDefs}
    │
    └── SearchboxModal
            │
            v
        Datagrid<T> columnDefs={...}  (mapping interno a DatagridColDef<T>)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/@types/searchbox.d.ts` | Modify | Rename `DatagridColDef<T>` a `SearchboxColDef<T>`, mantenere `graphField` e `action`, basare su `ColDef<T>` |
| `src/components/common/form/searchbox/Searchbox.tsx` | Modify | Aggiungere stato `debouncedValue` con useEffect+setTimeout, passare `debouncedValue` a `useSearchboxQueryParams`/`useFetchData`, rimuovere branch condizionale Paper "Nessun risultato" (righe 214-234), passare `onNavigateBack` callback a ContainerGridResults, aggiornare tipi |
| `src/components/common/form/searchbox/ContainerGridResults.tsx` | Modify | Aggiungere prop `onNavigateBack` e passarla a GridResults |
| `src/components/common/form/searchbox/GridResults.tsx` | Modify | Aggiungere prop `onNavigateBack`, estendere `handleCellKeyDown` per ArrowUp a rowIndex===0, aggiornare tipo `columnDefs` da `ColDef<T>[]` a `SearchboxColDef<T>[]`, rendere il wrapping a `ColDef<DatagridData<T>>` type-safe, configurare `overlayNoRowsTemplate` |
| `src/components/common/form/searchbox/SearchboxModal.tsx` | Modify | Cambiare tipo `columnDefs` da `DatagridColDef<T>[]` (importato da Datagrid.d.ts) a `SearchboxColDef<T>[]` (importato da searchbox.d.ts), aggiungere mapping interno a `DatagridColDef<T>[]` per il Datagrid base |
| `src/components/common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions.tsx` | Modify | Rename import `DatagridColDef` a `SearchboxColDef` |
| `src/components/common/form/searchbox/searchboxOptions/utenteSearchboxOptions.tsx` | Modify | Rename import `DatagridColDef` a `SearchboxColDef` |
| `src/components/common/form/searchbox/searchboxOptions/ruoloSearchboxOptions.tsx` | Modify | Rename import `DatagridColDef` a `SearchboxColDef` |
| `src/components/common/form/searchbox/searchboxOptions/menuSearchboxOptions.tsx` | Modify | Rename import `DatagridColDef` a `SearchboxColDef` |
| `src/components/common/form/searchbox/searchboxOptions/fatturaAcquistoSearchboxOptions.tsx` | Modify | Rename import `DatagridColDef` a `SearchboxColDef` |

## Interfaces / Contracts

### SearchboxColDef (searchbox.d.ts - dopo rename)

```tsx
import { ColDef } from "ag-grid-community";

type ColumnAction = "update" | "remove";

export interface SearchboxColDef<T extends Record<string, unknown>> extends ColDef<T> {
  graphField?: string;
  action?: ColumnAction;
}

interface SearchboxOptions<T extends Record<string, unknown>> {
  query: string;
  id: Extract<keyof T, string>;
  tableName: string;
  additionalWhere?: string;
  view?: string;
  items: SearchboxColDef<T>[];
  modal: {
    title: string;
    fragment?: string;
    items: SearchboxColDef<T>[];
  };
}
```

### GridResultsProps (aggiornato)

```tsx
export interface GridResultsProps<T extends Record<string, unknown>> {
  loading: boolean;
  items: T[];
  columnDefs: SearchboxColDef<T>[];
  onSelectedItem: (item: T, event: RowDoubleClickedEvent<T> | CellKeyDownEvent<T>) => void;
  onGridReady: (event: GridReadyEvent<T>) => void;
  onNavigateBack?: () => void;
}
```

### ContainerGridResultsProps (aggiornato)

```tsx
interface ContainerGridResultsProps<T extends Record<string, unknown>> extends GridResultsProps<T> {
  searchBoxId: string;
}
```

### SearchboxModalProps (aggiornato)

```tsx
interface SearchboxModalProps<T extends Record<string, unknown>> {
  open: boolean;
  title: string;
  items: T[];
  columnDefs: SearchboxColDef<T>[];
  loading: boolean;
  onClose: () => void;
  onSelectItem: (item: T) => void;
}
```

### Debounce state in Searchbox

```tsx
// Nuovo stato per il debounce
const [debouncedValue, setDebouncedValue] = useState(value);

// useEffect per debounce
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedValue(innerValue);
  }, 300);
  return () => clearTimeout(timer);
}, [innerValue]);

// useFetchData usa debouncedValue invece di innerValue
const { query, variables } = useSearchboxQueryParams({
  options,
  value: debouncedValue,
  fieldName: lookupFieldName,
  orderBy,
});

const { items, loading } = useFetchData({
  query,
  variables,
  skip: (debouncedValue || "").toString().trim().length < 3,
});
```

### Arrow Up handler in GridResults

```tsx
const handleCellKeyDown = useCallback(
  (params: DatagridCellKeyDownEvent<T>) => {
    if (!params.data || !params.event) return;
    const keyboardEvent = params.event as KeyboardEvent;

    if (keyboardEvent.key === "Enter" && params.data) {
      const { status, ...originalData } = params.data;
      onSelectedItem(originalData as unknown as T, params as unknown as CellKeyDownEvent<T>);
    }

    if (keyboardEvent.key === "ArrowUp" && params.rowIndex === 0 && onNavigateBack) {
      keyboardEvent.preventDefault();
      onNavigateBack();
    }
  },
  [onSelectedItem, onNavigateBack]
);
```

### Wrapping type-safe in GridResults

```tsx
// Conversione SearchboxColDef<T> -> ColDef<DatagridData<T>> senza as any
const wrappedColumnDefs = useMemo<ColDef<DatagridData<T>>[]>(
  () =>
    columnDefs.map((col) => {
      const { graphField, action, ...agCol } = col;
      return agCol as ColDef<DatagridData<T>>;
    }),
  [columnDefs]
);
```

### Wrapping type-safe in SearchboxModal

```tsx
import { SearchboxColDef } from "../../../../@types/searchbox";
import { DatagridColDef } from "../../datagrid/@types/Datagrid";

// Conversione SearchboxColDef<T> -> DatagridColDef<T> per il Datagrid base
const wrappedColumnDefs = useMemo<DatagridColDef<T>[]>(
  () =>
    columnDefs.map((col) => {
      const { graphField, action, ...agCol } = col;
      return agCol as DatagridColDef<T>;
    }),
  [columnDefs]
);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual | Debounce riduce query GraphQL | Aprire DevTools Network, digitare velocemente nel searchbox, verificare che le query partano solo dopo pausa di ~300ms |
| Manual | Griglia visibile con 0 risultati | Cercare un termine che non esiste, verificare che appaia la griglia con messaggio "Nessun risultato trovato" invece del Paper |
| Manual | Arrow Up dalla prima riga | Navigare con ArrowDown nella griglia, poi ArrowUp dalla prima riga, verificare che il focus torni al textfield |
| Manual | Nessun `as any` rimasto | `grep -r "as any" src/components/common/form/searchbox/` deve restituire 0 risultati |
| Static | TypeScript type check | `npm run ts:check` deve passare senza errori nei file modificati |
| Static | ESLint | `npm run lint` deve passare senza errori |

## Migration / Rollout

No migration required. Tutte le modifiche sono nel modulo searchbox frontend. Nessun impatto su database, backend, o contratti API. Rollback tramite `git revert`.

## Open Questions

- [ ] Il debounce combinato (300ms in Searchbox + 300ms in `useFetchData`) potrebbe risultare in un ritardo totale fino a ~600ms nel caso peggiore. Valutare se ridurre il debounce di Searchbox a 200ms o rimuovere quello interno di `useFetchData` (che pero' e' condiviso da tutti i consumer). Raccomandazione: iniziare con 300ms in Searchbox e valutare la UX; se troppo lento, ridurre a 150-200ms.
