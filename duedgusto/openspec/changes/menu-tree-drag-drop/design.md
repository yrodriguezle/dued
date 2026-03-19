# Technical Design: Menu Tree Always-On + Drag & Drop tra Rami

## Architecture Decision Records

### ADR-1: Modifiche confinate a MenuForm.tsx

**Contesto**: Il Datagrid generico passa gia tutte le props non estratte ad AG Grid via `...gridProps` (riga 72 di Datagrid.tsx). Le props `rowDragManaged`, `onRowDragEnd`, e `rowDragText` non sono estratte dal destructuring e quindi vengono inoltrate ad AgGrid senza modifiche.

**Decisione**: Tutte le modifiche saranno in `MenuForm.tsx`. Nessuna modifica a `Datagrid.tsx` o `AgGrid.tsx`.

**Motivazione**: Il componente Datagrid e un wrapper generico riusato in molti contesti. Le props AG Grid per il drag & drop passano gia attraverso `gridProps`. Modificare Datagrid aggiungerebbe complessita inutile e rischio di regressione in altri usi (MenuList, RoleMenus, ecc.).

### ADR-2: Uso di `rowDragManaged` con `onRowDragEnd` (non `onRowDragMove`)

**Contesto**: AG Grid v33 offre due modalita: managed row drag (la griglia gestisce lo spostamento visuale) e unmanaged (lo sviluppatore gestisce tutto).

**Decisione**: Usare `rowDragManaged={true}` per il feedback visuale nativo e `onRowDragEnd` per la logica di re-parenting.

**Motivazione**: Il managed mode fornisce animazione e indicatore di drop nativi. Serve solo l'handler finale per aggiornare `menuPadreId`.

### ADR-3: Validazione anti-ciclo tramite traversal ascendente

**Contesto**: Spostare un nodo parent sotto un proprio figlio creerebbe un ciclo nell'albero.

**Decisione**: Implementare una funzione `isDescendantOf(nodeId, potentialParentId, allNodes)` che risale l'albero tramite `menuPadreId` per verificare che il target non sia un discendente.

**Motivazione**: L'approccio ascendente e O(h) dove h = profondita dell'albero, piu efficiente del traversal discendente. La struttura menu ha profondita tipica < 5.

### ADR-4: Drag handle solo nella colonna gruppo (autoGroupColumnDef)

**Contesto**: AG Grid permette `rowDrag` su qualsiasi colonna o sulla colonna di auto-gruppo.

**Decisione**: Abilitare `rowDrag: true` solo nell'`autoGroupColumnDef` e solo in edit mode (`rowDrag: !readOnly`).

**Motivazione**: L'icona drag nella colonna "Voce di menu" e intuitiva (si trascina l'elemento per il suo nome). In read-only mode non c'e motivo di mostrare il drag handle.

## Component Design

### File modificato: `src/components/pages/menu/MenuForm.tsx`

#### Nuova funzione helper: `isDescendantOf`

```
isDescendantOf(
  nodeId: number,
  potentialParentId: number,
  nodesMap: Map<number, MenuNonNull>
): boolean
```

Definita fuori dal componente (pura, senza dipendenze da React). Percorre l'albero dal `potentialParentId` verso la radice seguendo `menuPadreId`. Se incontra `nodeId` durante il percorso, restituisce `true` (il nodo target e un discendente, il drop creerebbe un ciclo).

#### Nuova funzione helper: `buildNodesMap`

```
buildNodesMap(api: GridApi): Map<number, MenuNonNull>
```

Costruisce una mappa id -> dati nodo iterando tutti i nodi della griglia con `api.forEachNode()`. Usata da `isDescendantOf` per accesso O(1) ai nodi parent.

#### Modifiche al componente MenuForm

1. **`autoGroupColumnDef`**: aggiungere `rowDrag: !readOnly` per mostrare l'icona drag in edit mode.

2. **Prop `treeData`**: cambiare da `treeData={readOnly}` a `treeData` (sempre true).

3. **Handler `handleRowDragEnd`**: nuovo `useCallback` che:
   - Estrae `node` (nodo trascinato) e `overNode` (nodo destinazione) dall'evento
   - Se `overNode` e null/undefined, imposta `menuPadreId = null` (spostamento a root)
   - Se `overNode` esiste, il nuovo `menuPadreId` e `overNode.data.id`
   - Chiama `isDescendantOf` per validare che non si crei un ciclo:
     - Se ciclo rilevato: mostra toast di errore e return (nessuna modifica)
   - Se il drag e su se stesso (nodeId === overNodeId): return (no-op)
   - Aggiorna `node.data.menuPadreId` con il nuovo valore
   - Marca `node.data.status = DatagridStatus.Modified`
   - Chiama `api.applyTransaction({ update: [node.data] })` per aggiornare la griglia
   - Chiama `setFieldValue("gridDirty", true)` per triggerare il dirty check Formik

4. **Props Datagrid**: aggiungere `rowDragManaged={!readOnly}` e `onRowDragEnd={handleRowDragEnd}` che passano via `gridProps` ad AG Grid.

## Sequence Diagram: Drag & Drop Re-parenting

```
User          MenuForm/AG Grid       isDescendantOf    Formik
 |                  |                      |              |
 |-- drag row A --> |                      |              |
 |                  |                      |              |
 |-- drop on B -->  |                      |              |
 |                  |                      |              |
 |            onRowDragEnd fires           |              |
 |                  |                      |              |
 |                  |-- A == B? -----------|              |
 |                  |   (yes: return)      |              |
 |                  |                      |              |
 |                  |-- isDescendantOf --->|              |
 |                  |   (A.id, B.id, map)  |              |
 |                  |                      |              |
 |                  |<-- false (ok) -------|              |
 |                  |                      |              |
 |            A.menuPadreId = B.id         |              |
 |            A.status = Modified          |              |
 |                  |                      |              |
 |            api.applyTransaction         |              |
 |            ({ update: [A] })            |              |
 |                  |                      |              |
 |                  |-- setFieldValue ---->|              |
 |                  |   ("gridDirty", true)|              |
 |                  |                      |              |
 |<-- tree updates -|                      |              |
```

```
[Caso ciclo rilevato]

User          MenuForm/AG Grid       isDescendantOf    Toast
 |                  |                      |              |
 |-- drop A on C -->|                      |              |
 |            (C e figlio di A)            |              |
 |                  |                      |              |
 |                  |-- isDescendantOf --->|              |
 |                  |   (A.id, C.id, map)  |              |
 |                  |                      |              |
 |                  |<-- true (ciclo!) ----|              |
 |                  |                      |              |
 |                  |-- showToast -------->|              |
 |                  |   "Impossibile..."   |              |
 |                  |                      |              |
 |            return (no changes)          |              |
```

## Data Flow

### Stato prima del drag

```
Griglia AG Grid (tree mode):
  Root
  ├── Menu A (id: 1, menuPadreId: null)
  │   ├── Menu B (id: 2, menuPadreId: 1)
  │   └── Menu C (id: 3, menuPadreId: 1)
  └── Menu D (id: 4, menuPadreId: null)
```

### Dopo drag di Menu B su Menu D

```
Modifiche in memoria:
  Menu B: { menuPadreId: 1 -> 4, status: Modified }

Griglia AG Grid (tree mode):
  Root
  ├── Menu A (id: 1, menuPadreId: null)
  │   └── Menu C (id: 3, menuPadreId: 1)
  └── Menu D (id: 4, menuPadreId: null)
      └── Menu B (id: 2, menuPadreId: 4)

Formik: gridDirty = true
```

## Type Definitions

Nessun nuovo tipo necessario. I tipi esistenti coprono gia tutto:
- `MenuNonNull` e `MenuWithStatus` da `menuSearchboxOptions.tsx`
- `DatagridRowDragEndEvent<T>` da `Datagrid.d.ts` (riga 133)
- `DatagridStatus` da `constants.tsx`
- `RowDragEndEvent` include `node`, `overNode`, `api`

## Props Flow Through Datagrid

```
MenuForm.tsx
  └── <Datagrid
        rowDragManaged={!readOnly}     ──┐
        onRowDragEnd={handleRowDragEnd}  │
        treeData                         │
        ...other props                   │
      />                                 │
                                         │
Datagrid.tsx (riga 55-72)                │
  const { items, height, readOnly,       │
    columnDefs, getNewRow, ...gridProps   │  ← rowDragManaged e onRowDragEnd
  } = props;                             │    finiscono in gridProps
                                         │
  <AgGrid                                │
    {...gridProps}  ─────────────────────┘
    rowData={rowData}
    ...
  />
```

## Edge Cases

| Scenario | Comportamento |
|----------|--------------|
| Drop su se stesso | No-op (early return) |
| Drop su un discendente | Toast errore + no-op |
| Drop fuori dalla griglia | `overNode` e null: nodo diventa root (`menuPadreId = null`) |
| Drop su nodo root (stesso livello) | `menuPadreId = overNode.data.id` — il nodo diventa figlio del target |
| Drag di nodo con figli | I figli mantengono il loro `menuPadreId` e seguono il parent nel tree |
| Nuova riga (id: 0) trascinata | Funziona normalmente, `menuPadreId` viene aggiornato |
| readOnly = true | `rowDragManaged={false}`, drag handle nascosto, `onRowDragEnd` non invocato |

## Impact Analysis

| File | Tipo modifica | Righe stimate |
|------|--------------|---------------|
| `src/components/pages/menu/MenuForm.tsx` | Modificato | ~50 righe aggiunte |
| `src/components/common/datagrid/Datagrid.tsx` | Nessuna | 0 |
| `src/components/common/datagrid/AgGrid.tsx` | Nessuna | 0 |
| `src/components/common/datagrid/@types/Datagrid.d.ts` | Nessuna | 0 (tipi RowDrag gia presenti) |

## Dependencies

- AG Grid Enterprise v33: `TreeDataModule` (registrato in AgGrid.tsx riga 11)
- AG Grid Community: `AllCommunityModule` include `RowDragModule` (registrato in AgGrid.tsx riga 11)
- `showToast` da `src/common/toast/showToast` (per errore anti-ciclo)
- Formik context (`setFieldValue`) gia usato nel componente

## Risks and Mitigations

| Rischio | Probabilita | Mitigazione |
|---------|-------------|-------------|
| `rowDragManaged` non funziona con tree data in AG Grid v33 | Bassa | La documentazione AG Grid conferma compatibilita. Fallback: usare unmanaged drag con `onRowDragMove` |
| `applyTransaction` non triggera il re-render del tree | Bassa | AG Grid ricalcola i percorsi tree automaticamente quando `treeDataParentIdField` e impostato. Fallback: `api.refreshClientSideRowModel()` |
| Conflitto tra `singleClickEdit` e drag handle | Bassa | AG Grid da priorita al drag handle. L'editing si attiva solo cliccando su celle non-drag |
| Performance con menu molto numerosi (>1000 nodi) | Molto bassa | `isDescendantOf` e O(h) con mappa O(1). La build della mappa e O(n) ma avviene solo al drop |
