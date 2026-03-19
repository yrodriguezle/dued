# Design Tecnico: menu-crud-mutation

## Panoramica

Questo documento descrive l'architettura tecnica per implementare le mutation GraphQL di CRUD per i menu, coprendo backend (.NET/GraphQL.NET) e frontend (React/Apollo Client). Il design segue i pattern consolidati di `mutateRuolo`/`deleteRuolo`.

---

## 1. Backend

### 1.1 MenuInputType

**File**: `backend/GraphQL/Authentication/Types/MenuInputType.cs`

Segue esattamente il pattern di `RuoloInputType`. Mappa tutti i campi del modello `Menu` che l'utente puo modificare nella griglia.

```csharp
public class MenuInputType : InputObjectGraphType<Menu>
{
    Name = "MenuInput";

    Field<NonNullGraphType<IntGraphType>>(nameof(Menu.Id));          // 0 = nuovo, >0 = esistente
    Field<NonNullGraphType<StringGraphType>>(nameof(Menu.Titolo));
    Field<StringGraphType>(nameof(Menu.Percorso));
    Field<StringGraphType>(nameof(Menu.Icona));
    Field<BooleanGraphType>(nameof(Menu.Visibile));
    Field<IntGraphType>(nameof(Menu.Posizione));
    Field<StringGraphType>(nameof(Menu.PercorsoFile));
    Field<StringGraphType>(nameof(Menu.NomeVista));
    Field<IntGraphType>(nameof(Menu.MenuPadreId));                   // nullable
}
```

**Decisione**: `Id` e `Titolo` sono `NonNull` perche obbligatori. Tutti gli altri campi sono nullable nell'input per consentire aggiornamenti parziali. `Visibile` non e `NonNull` perche ha un valore default `true` nel modello.

### 1.2 Mutation `mutateMenus`

**File**: `backend/GraphQL/Authentication/AuthMutations.cs` (aggiungere al costruttore)

```
Field<ListGraphType<MenuType>, List<Menu>>("mutateMenus")
    .Argument<NonNullGraphType<ListGraphType<NonNullGraphType<MenuInputType>>>>("menus")
    .ResolveAsync(async context => { ... })
```

**Logica upsert**:

1. Riceve `List<Menu> inputs` da `context.GetArgument<List<Menu>>("menus")`
2. Per ogni input:
   - Se `input.Id == 0`: crea nuovo `Menu`, assegna tutti i campi, `dbContext.Menus.Add(menu)`
   - Se `input.Id > 0`: cerca `await dbContext.Menus.FindAsync(input.Id)`, aggiorna i campi
   - Se non trovato: lancia `ExecutionError("Menu non trovato: id={input.Id}")`
3. `await dbContext.SaveChangesAsync()`
4. Ritorna la lista dei menu processati (con ID generati per i nuovi)

**Decisione architetturale**: A differenza di `mutateRuolo` che gestisce un singolo elemento, `mutateMenus` accetta una lista per supportare il batch save dalla griglia. Questo riduce i round-trip da N a 1. Usiamo un unico `SaveChangesAsync()` alla fine per garantire atomicita: o tutti i menu vengono salvati, o nessuno.

### 1.3 Mutation `deleteMenus`

**File**: `backend/GraphQL/Authentication/AuthMutations.cs` (aggiungere al costruttore)

```
Field<BooleanGraphType, bool>("deleteMenus")
    .Argument<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("ids")
    .ResolveAsync(async context => { ... })
```

**Logica di cancellazione**:

1. Riceve `List<int> ids` da `context.GetArgument<List<int>>("ids")`
2. Carica tutti i menu da cancellare: `dbContext.Menus.Where(m => ids.Contains(m.Id))`
3. Verifica che i menu con `Ruoli` associati (tabella join `RuoloMenu`) non vengano cancellati senza avvertimento - in realta la cascade sulla tabella `RuoloMenu` gestisce gia questo caso (`OnDelete(DeleteBehavior.Cascade)`)
4. `dbContext.Menus.RemoveRange(menus)`
5. `await dbContext.SaveChangesAsync()`
6. Ritorna `true`

**Decisione architetturale - cascade**: Il modello EF Core ha gia `DeleteBehavior.Cascade` sulla relazione `MenuPadre → Figli`. Questo significa che cancellare un menu padre cancella automaticamente tutti i figli. La mutation **non** deve validare manualmente i figli perche EF Core e il database gestiscono la cascade. Il frontend deve pero assicurarsi di non inviare nella lista degli ID di delete sia il padre che i figli (sarebbero ridondanti ma non causerebbero errori). Anche la relazione many-to-many `RuoloMenu` ha cascade, quindi eliminare un menu rimuove automaticamente le righe dalla tabella join.

---

## 2. Frontend

### 2.1 mutations.tsx

**File**: `duedgusto/src/graphql/menus/mutations.tsx` (nuovo)

Due documenti GraphQL tipizzati, seguendo il pattern di `ruolo/mutations.tsx`:

```typescript
// ── mutationSubmitMenus ──
interface SubmitMenusData {
  authentication: {
    mutateMenus: MenuNonNull[];
  };
}

export interface SubmitMenusValues {
  menus: MenuInput[];
}

// MenuInput: tipo locale che mappa i campi per la mutation
export interface MenuInput {
  id: number;
  titolo: string;
  percorso: string;
  icona: string;
  visibile: boolean;
  posizione: number;
  percorsoFile: string;
  nomeVista: string;
  menuPadreId: number | null;
}

// gql con menuFragment + mutation SubmitMenus($menus: [MenuInput!]!)

// ── mutationDeleteMenus ──
interface DeleteMenusData {
  authentication: {
    deleteMenus: boolean;
  };
}

// gql mutation DeleteMenus($ids: [Int!]!)
```

**Decisione**: Non usiamo il `menuFragment` nella mutation delete perche ritorna solo `boolean`. Per la mutation submit, usiamo `...MenuFragment` per ottenere tutti i campi aggiornati nella risposta.

### 2.2 useSubmitMenu.tsx (riscrittura)

**File**: `duedgusto/src/graphql/menus/useSubmitMenu.tsx` (modificato)

Riscrittura completa. Elimina il `setTimeout` stub e usa `useMutation`:

```typescript
function useSubmitMenu() {
  const [mutate, { data, error, loading }] = useMutation(mutationSubmitMenus);

  const submitMenus = async (variables: SubmitMenusValues) => {
    const result = await mutate({ variables });
    return result.data?.authentication?.mutateMenus ?? null;
  };

  return { submitMenus, data, error, loading };
}
```

**Nota**: la firma cambia da `submitMenu({ menu })` a `submitMenus({ menus })` perche ora e batch.

### 2.3 useDeleteMenus.tsx (nuovo)

**File**: `duedgusto/src/graphql/menus/useDeleteMenus.tsx` (nuovo)

Segue il pattern di `useDeleteRuolo`:

```typescript
function useDeleteMenus() {
  const [mutate, { loading }] = useMutation(mutationDeleteMenus);

  const deleteMenus = async (ids: number[]) => {
    const result = await mutate({ variables: { ids } });
    return result.data?.authentication?.deleteMenus ?? false;
  };

  return { deleteMenus, loading };
}
```

### 2.4 MenuForm.tsx (modifiche)

**Modifiche necessarie**:

1. **Tracking righe cancellate**: Aggiungere un `useRef<number[]>` (`deletedRowIdsRef`) per accumulare gli ID delle righe cancellate. Il ref viene popolato tramite il callback `onRowsDeleted` del Datagrid.

2. **Esporre i dati per il submit**: Usare `useImperativeHandle` con un `forwardRef` per esporre un metodo `getSubmitData()` che ritorna:
   - `modifiedAndAdded`: righe con `status === Modified || status === Added` (dal `context.getGridData()`)
   - `deletedIds`: dal ref `deletedRowIdsRef`

3. **Reset del ref**: Esporre un metodo `resetDeletedIds()` da chiamare dopo un salvataggio riuscito.

**Alternativa considerata e scelta**: Invece di `forwardRef + useImperativeHandle`, usiamo un pattern piu semplice con callback props. MenuDetails passa a MenuForm un ref callback che MenuForm popola nel suo effetto. Ma il pattern `forwardRef` e piu pulito per questo caso e gia usato altrove nel codebase. Tuttavia, dato che MenuForm non e attualmente un `forwardRef`, la soluzione piu leggera e passare il `deletedRowIdsRef` da MenuDetails come prop e leggere i dati della griglia tramite l'evento `context.getGridData()` gia esposto dal Datagrid. MenuDetails puo creare il ref e passarlo a MenuForm, che lo popola in `onRowsDeleted`.

**Soluzione scelta**: MenuDetails crea `deletedRowIdsRef = useRef<number[]>([])` e lo passa a MenuForm. MenuForm implementa `onRowsDeleted` che aggiunge gli ID al ref. Il `gridRef` per accedere a `getGridData()` viene gia gestito dal Datagrid internamente, quindi MenuForm deve esporre i dati della griglia. La via piu semplice: MenuForm riceve anche un `gridDataRef = useRef<DatagridData<MenuWithStatus>[]>([])` che aggiorna via `onRowDataUpdated`.

**Soluzione finale (piu semplice)**: Dato che il Datagrid espone `context.getGridData()` e che `onRowsDeleted` fornisce le righe cancellate, la strategia e:

- MenuDetails crea `deletedRowIdsRef: useRef<number[]>([])`
- MenuDetails crea `gridApiRef: useRef<GridReadyEvent | null>(null)`
- MenuForm riceve entrambi come props
- MenuForm connette `onRowsDeleted` per popolare `deletedRowIdsRef` (filtrando `id > 0` perche le righe nuove non hanno ID persistito)
- MenuForm connette `onGridReady` per salvare l'api reference in `gridApiRef`
- Al submit, MenuDetails usa `gridApiRef.current` per leggere i dati via `forEachNode`

### 2.5 MenuDetails.tsx (modifiche)

**Modifiche a `onSubmit`**:

1. Legge `gridApiRef` per ottenere tutti i dati correnti della griglia
2. Filtra le righe con `status === Added || status === Modified`
3. Mappa le righe a `MenuInput` (rimuovendo `__typename`, `status` e altri campi non necessari)
4. Legge `deletedRowIdsRef.current` per gli ID da cancellare
5. Esegue le mutation nell'ordine corretto (vedi diagramma di sequenza)
6. Dopo il successo, chiama `refetch()` per ricaricare i dati aggiornati
7. Reset del `deletedRowIdsRef`

---

## 3. Diagramma di Sequenza — Flusso di Salvataggio

```
Utente          MenuDetails              useDeleteMenus     useSubmitMenu      Backend (GraphQL)     DB
  |                  |                        |                   |                   |               |
  |  click Salva     |                        |                   |                   |               |
  |----------------->|                        |                   |                   |               |
  |                  | legge gridApiRef       |                   |                   |               |
  |                  | (forEachNode)          |                   |                   |               |
  |                  |                        |                   |                   |               |
  |                  | filtra Modified/Added  |                   |                   |               |
  |                  | legge deletedRowIdsRef |                   |                   |               |
  |                  |                        |                   |                   |               |
  |                  |  [deletedIds.length>0] |                   |                   |               |
  |                  |  deleteMenus(ids)      |                   |                   |               |
  |                  |----------------------->|                   |                   |               |
  |                  |                        | mutation           |                   |               |
  |                  |                        | DeleteMenus       |                   |               |
  |                  |                        |------------------>|                   |               |
  |                  |                        |                   | Menus.RemoveRange  |               |
  |                  |                        |                   |------------------>|  DELETE        |
  |                  |                        |                   |                   |-------------->|
  |                  |                        |                   |                   |  cascade figli |
  |                  |                        |                   |                   |  cascade join  |
  |                  |                        |                   |<------------------|               |
  |                  |                        |<------------------|  true             |               |
  |                  |<-----------------------|                   |                   |               |
  |                  |                        |                   |                   |               |
  |                  |  [menus.length>0]      |                   |                   |               |
  |                  |  submitMenus(menus)    |                   |                   |               |
  |                  |------------------------------------------>|                   |               |
  |                  |                        |                   | mutation           |               |
  |                  |                        |                   | SubmitMenus        |               |
  |                  |                        |                   |------------------>|               |
  |                  |                        |                   | foreach menu:     |               |
  |                  |                        |                   |  id=0 → INSERT    |               |
  |                  |                        |                   |  id>0 → UPDATE    |               |
  |                  |                        |                   |                   |  UPSERT       |
  |                  |                        |                   |                   |-------------->|
  |                  |                        |                   |<------------------|               |
  |                  |                        |                   | List<Menu>        |               |
  |                  |<------------------------------------------|                   |               |
  |                  |                        |                   |                   |               |
  |                  | refetch() via useGetAll|                   |                   |               |
  |                  | (network-only)         |                   |                   |               |
  |                  |------------------------------------------------------->|               |
  |                  |                        |                   |            | SELECT * menus |
  |                  |                        |                   |            |--------------->|
  |                  |<-------------------------------------------------------|               |
  |                  |                        |                   |                   |               |
  |                  | reset deletedRowIdsRef |                   |                   |               |
  |                  | toast successo         |                   |                   |               |
  |<-----------------|                        |                   |                   |               |
```

### Ordine di esecuzione: Delete PRIMA di Upsert

**Razionale**: Se l'utente cancella un menu padre e poi crea un nuovo menu con un diverso `menuPadreId`, eseguire prima la delete evita conflitti di foreign key. Inoltre, eliminare prima libera i vincoli di unicita (se in futuro ne venissero aggiunti su `percorso` o `nomeVista`).

### Strategia di refetch

Dopo entrambe le mutation (delete + upsert), si chiama `refetch()` dal hook `useGetAll`. Questo usa `fetchPolicy: "network-only"` per forzare un reload dal server. Il refetch e necessario perche:
- Le righe nuove (id=0) ricevono un ID reale dal database
- L'albero gerarchico potrebbe essere cambiato
- I figli eliminati in cascade non sono noti al frontend

---

## 4. Gestione Errori

### Backend
- `ExecutionError("Menu non trovato: id={id}")` se un menu con `id > 0` non esiste nel DB
- EF Core lancia `DbUpdateException` se un vincolo DB viene violato (la mutation lo lascia propagare come errore GraphQL)

### Frontend
- L'error link di Apollo Client gestisce gia `ACCESS_DENIED` (401) con refresh token
- Il `catch` in `onSubmit` mostra un toast di errore con `error.message`
- Se la delete fallisce, l'upsert non viene eseguito (fail-fast)
- I dati nella griglia vengono preservati in caso di errore (nessun reset, nessun refetch)

---

## 5. Mapping dei Tipi

| Campo Menu (Model) | MenuInputType (GraphQL) | MenuInput (TS) | MenuFragment (GQL) | Note |
|---------------------|-------------------------|-----------------|---------------------|------|
| `Id` | `NonNull<Int>` | `id: number` | `id` | 0 = nuovo |
| `Titolo` | `NonNull<String>` | `titolo: string` | `titolo` | obbligatorio |
| `Percorso` | `String` | `percorso: string` | `percorso` | |
| `Icona` | `String` | `icona: string` | `icona` | nome icona MUI |
| `Visibile` | `Boolean` | `visibile: boolean` | `visibile` | default true |
| `Posizione` | `Int` | `posizione: number` | `posizione` | ordine display |
| `PercorsoFile` | `String` | `percorsoFile: string` | `percorsoFile` | path componente |
| `NomeVista` | `String` | `nomeVista: string` | `nomeVista` | nome view |
| `MenuPadreId` | `Int` (nullable) | `menuPadreId: number \| null` | `menuPadreId` | gerarchia |
| `Ruoli` | — | — | — | non incluso nell'input |
| `MenuPadre` | — | — | — | navigazione, non input |
| `Figli` | — | — | — | navigazione, non input |

---

## 6. Riepilogo File Coinvolti

| File | Azione | Descrizione |
|------|--------|-------------|
| `backend/GraphQL/Authentication/Types/MenuInputType.cs` | **Nuovo** | Input type GraphQL per Menu |
| `backend/GraphQL/Authentication/AuthMutations.cs` | **Modificato** | Aggiungere `mutateMenus` e `deleteMenus` |
| `duedgusto/src/graphql/menus/mutations.tsx` | **Nuovo** | Documenti GQL tipizzati per le mutation |
| `duedgusto/src/graphql/menus/useSubmitMenu.tsx` | **Riscritto** | Da stub a `useMutation` reale |
| `duedgusto/src/graphql/menus/useDeleteMenus.tsx` | **Nuovo** | Hook per delete batch |
| `duedgusto/src/components/pages/menu/MenuForm.tsx` | **Modificato** | Props per `deletedRowIdsRef`, `gridApiRef`, `onRowsDeleted` |
| `duedgusto/src/components/pages/menu/MenuDetails.tsx` | **Modificato** | Crea refs, passa props, implementa `onSubmit` reale con mutation |

---

## 7. Decisioni Architetturali

### ADR-1: Batch upsert in singola mutation
**Contesto**: La griglia puo avere N righe modificate/aggiunte.
**Decisione**: Una singola mutation `mutateMenus` che accetta una lista.
**Razionale**: Riduce i round-trip. Un unico `SaveChangesAsync()` garantisce atomicita.
**Alternative scartate**: Mutation singola chiamata N volte (piu round-trip, no atomicita).

### ADR-2: Delete separata da upsert
**Contesto**: Le delete potrebbero essere incluse nella stessa mutation di upsert.
**Decisione**: Mutation `deleteMenus` separata, eseguita prima di `mutateMenus`.
**Razionale**: Segue il pattern esistente (`deleteRuolo` separato da `mutateRuolo`). Separare le operazioni rende il codice piu leggibile e il debugging piu semplice. L'ordine (delete first) evita conflitti FK.

### ADR-3: Refetch completo invece di aggiornamento cache
**Contesto**: Dopo il salvataggio, i dati nella griglia devono riflettere lo stato del DB.
**Decisione**: Refetch completo via `useGetAll.refetch()` con `network-only`.
**Razionale**: Le righe nuove ottengono ID reali. I figli eliminati in cascade non sono noti al client. Il refetch e semplice e affidabile. Il costo e accettabile (i menu sono poche decine di righe).

### ADR-4: Comunicazione MenuDetails ↔ MenuForm via refs
**Contesto**: MenuDetails ha bisogno dei dati della griglia e degli ID cancellati.
**Decisione**: MenuDetails crea `deletedRowIdsRef` e `gridApiRef`, li passa a MenuForm come props.
**Razionale**: Evita la complessita di `forwardRef + useImperativeHandle`. I refs sono leggeri, sincroni, e non causano re-render.
