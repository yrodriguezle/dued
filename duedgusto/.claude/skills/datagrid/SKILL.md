---
name: datagrid
description: Skill per lavorare con le tabelle dati nel progetto DuedGusto. Usa questa skill quando devi creare, modificare o debuggare componenti che usano AG Grid. Copre la creazione di colonne, validazione, editing inline, navigazione e integrazione con Formik/GraphQL.
---

# Datagrid Skill

Guida completa per lavorare con le tabelle dati (AG Grid) nel progetto DuedGusto.

---

## Regola Fondamentale

**MAI usare `AgGridReact` direttamente.** Usare SEMPRE il componente `Datagrid` da `src/components/common/datagrid/Datagrid.tsx`.

Il wrapper `Datagrid` gestisce automaticamente:
- Theming API v33 (tema chiaro/scuro sincronizzato con lo store Zustand)
- Localizzazione italiana
- Registrazione moduli AG Grid (Community + Enterprise)
- Tracking dello stato delle righe (`DatagridStatus`)
- Toolbar con pulsanti Aggiungi/Cancella riga
- Navigazione Tab con auto-aggiunta righe
- Validazione inline con Zod
- Numerazione automatica delle righe

**MAI importare CSS legacy di AG Grid:**
```tsx
// VIETATO
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
// VIETATO: <div className="ag-theme-alpine">
```

---

## Architettura del Sistema

```
src/components/common/datagrid/
  Datagrid.tsx              # Componente principale (USARE QUESTO)
  AgGrid.tsx                # Wrapper base di AgGridReact (uso interno)
  DatagridToolbar.tsx       # Toolbar con Aggiungi/Cancella
  datagridThemes.tsx        # Temi themeQuartz (light/dark)
  datagridUtils.tsx         # hiddenColumnProperties
  getFirstEditableColumn.tsx
  isCellEditable.tsx
  agGridTypes.tsx
  @types/
    Datagrid.d.ts           # Tutti i tipi: DatagridData, DatagridColDef, eventi, etc.
  columns/
    createRowNumberColumn.tsx
    RowNumberColumn.tsx
  editing/
    useEditingState.tsx     # Gestione stato editing (Started/Stopped)
    useEditingGrid.tsx      # Hook alternativo per editing
  navigation/
    useTabNavigation.tsx    # Tab su ultima cella -> nuova riga
  validation/
    useZodValidation.tsx    # Validazione righe con schema Zod
    useGridValidation.tsx
  i18n/
    it-IT.tsx               # Traduzioni italiane per AG Grid
```

---

## Due Modalita di Utilizzo

### 1. Modalita Editing (griglia editabile)

Per griglie dove l'utente aggiunge, modifica e cancella righe.

```tsx
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef } from "../../common/datagrid/@types/Datagrid";

interface MyItem extends Record<string, unknown> {
  description: string;
  amount: number;
}

const columnDefs: DatagridColDef<MyItem>[] = [
  { headerName: "Descrizione", field: "description", flex: 2, editable: true },
  { headerName: "Importo", field: "amount", flex: 1, editable: true,
    cellEditor: "agNumberCellEditor",
    cellEditorParams: { min: 0, precision: 2 },
    valueFormatter: (params) => `${Number(params.value).toFixed(2)}€`
  },
];

const getNewRow = (): MyItem => ({ description: "", amount: 0 });

<Datagrid<MyItem>
  height="300px"
  items={data}
  columnDefs={columnDefs}
  readOnly={false}
  getNewRow={getNewRow}
/>
```

**Props obbligatorie in modalita editing:**
- `height` - Altezza CSS della griglia
- `items` - Array dei dati
- `columnDefs` - Definizione colonne (tipo `DatagridColDef<T>`)
- `readOnly` - `boolean` che abilita/disabilita editing
- `getNewRow` - Factory function che restituisce una riga vuota (attiva auto-add su Tab)

### 2. Modalita Presentazione (sola lettura)

Per griglie di sola visualizzazione senza toolbar.

```tsx
<Datagrid<MyItem>
  presentation
  height="400px"
  items={data}
  columnDefs={columnDefs}
/>
```

**Con `presentation` attivo:**
- Nessuna toolbar
- Click singolo non apre editing
- Nessuna selezione riga
- Nessun numero riga

---

## Tipi Importanti

Tutti i tipi sono in `src/components/common/datagrid/@types/Datagrid.d.ts`.

### DatagridData<T>

Ogni riga nella griglia viene wrappata con un campo `status` ausiliario:

```tsx
type DatagridData<T> = DatagridAuxData & T;

interface DatagridAuxData {
  status: DatagridStatus;
}
```

### DatagridStatus

```tsx
// da src/common/globals/constants.tsx
const enum DatagridStatus {
  Added = 0,
  Unchanged = 1,
  Modified = 3,
  Invalid = 4,
  Valid = 5,
  Editing = 6,
}
```

### Tipi Colonne e Eventi

```tsx
// Usare SEMPRE questi tipi wrappati, MAI quelli diretti di AG Grid
import {
  DatagridColDef,          // ColDef<DatagridData<T>>
  DatagridData,            // T + { status: DatagridStatus }
  DatagridCellValueChangedEvent,
  DatagridGridReadyEvent,
  DatagridCellKeyDownEvent,
  ValidationError,
} from "../../common/datagrid/@types/Datagrid";
```

---

## Props del Componente Datagrid

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `height` | `string` | - | Altezza CSS (es. `"300px"`, `"calc(100vh - 200px)"`) |
| `items` | `T[]` | - | Dati sorgente (senza `status`, viene aggiunto automaticamente) |
| `columnDefs` | `DatagridColDef<T>[]` | - | Definizione colonne |
| `readOnly` | `boolean` | - | Disabilita editing (solo in modalita normale) |
| `presentation` | `true` | - | Attiva modalita sola lettura senza toolbar |
| `getNewRow` | `() => T` | - | Factory per nuove righe (abilita Tab auto-add) |
| `addNewRowAt` | `"top" \| "bottom"` | `"bottom"` | Dove inserire le nuove righe |
| `showRowNumbers` | `boolean` | `true` | Mostra colonna numerazione |
| `hideToolbar` | `boolean` | `false` | Nasconde toolbar (solo in modalita editing) |
| `validationSchema` | `z.ZodSchema<T>` | - | Schema Zod per validazione inline |
| `onValidationErrors` | `(errors: Map<number, ValidationError[]>) => void` | - | Callback errori validazione |
| `getRowId` | AG Grid standard | - | Funzione per ID unico riga |
| `onCellValueChanged` | `DatagridCellValueChangedEvent<T>` | - | Callback modifica cella |
| `onGridReady` | `DatagridGridReadyEvent<T>` | - | Callback griglia pronta |
| ...altre props | `AgGridReactProps` | - | Tutte le props standard AG Grid vengono passate al componente interno |

---

## Validazione con Zod

```tsx
import { z } from "zod";

const schema = z.object({
  description: z.string().min(1, "La descrizione e obbligatoria"),
  amount: z.number().min(0, "L'importo deve essere >= 0"),
});

const [errors, setErrors] = useState<Map<number, ValidationError[]>>(new Map());

<Datagrid<MyItem>
  height="300px"
  items={data}
  columnDefs={columnDefs}
  readOnly={false}
  getNewRow={getNewRow}
  validationSchema={schema}
  onValidationErrors={setErrors}
/>

{/* Mostra errori */}
{errors.size > 0 && (
  <Box sx={{ mt: 1 }}>
    {Array.from(errors.entries()).map(([rowIndex, rowErrors]) => (
      <Typography key={rowIndex} color="error" variant="caption" display="block">
        Riga {rowIndex + 1}: {rowErrors.map(e => e.message).join(", ")}
      </Typography>
    ))}
  </Box>
)}
```

La validazione viene eseguita automaticamente su `onCellValueChanged`. Lo status della riga viene aggiornato a `DatagridStatus.Valid` o `DatagridStatus.Invalid`.

---

## Recupero Dati dalla Griglia

Per leggere i dati correnti dalla griglia (utile al salvataggio), usare il `context` esposto dalla griglia:

```tsx
const gridRef = useRef<GridReadyEvent<DatagridData<MyItem>> | null>(null);

const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<MyItem>>) => {
  gridRef.current = event;
}, []);

// Per leggere i dati al salvataggio:
const getData = () => {
  if (!gridRef.current) return [];
  const rows: DatagridData<MyItem>[] = [];
  gridRef.current.api.forEachNode(node => {
    if (node.data) rows.push(node.data);
  });
  return rows;
};
```

---

## Colonne Nascoste

Per nascondere una colonna (es. campi ID):

```tsx
import { hiddenColumnProperties } from "../../common/datagrid/datagridUtils";

const columnDefs: DatagridColDef<MyItem>[] = [
  { field: "id", ...hiddenColumnProperties },
  { field: "description", headerName: "Descrizione", flex: 1 },
];
```

---

## Comportamenti Automatici

### Tab Navigation
Quando `getNewRow` e fornito:
- Premere **Tab** sull'ultima cella editabile dell'ultima riga aggiunge automaticamente una nuova riga
- Il focus si sposta sulla prima cella editabile della nuova riga

### ESC su Righe Pristine
- Premere **Escape** su una riga non modificata (identica a `getNewRow()`) la rimuove automaticamente

### Stato Editing
- Le righe in editing mostrano `DatagridStatus.Editing`
- Uscendo dalla riga, lo status torna a `DatagridStatus.Modified`
- Il pulsante "Nuova riga" si disabilita durante l'editing

---

## Pattern Comune: Integrazione con Formik

```tsx
import { forwardRef, useCallback, useMemo } from "react";
import { useFormikContext } from "formik";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent } from "ag-grid-community";

interface MyItem extends Record<string, unknown> {
  description: string;
  amount: number;
}

interface Props {
  initialItems: MyItem[];
}

const MyDataGrid = forwardRef<GridReadyEvent<DatagridData<MyItem>>, Props>(
  ({ initialItems }, ref) => {
    const formik = useFormikContext<MyFormValues>();
    const isLocked = formik.status?.isFormLocked || false;

    const columnDefs = useMemo<DatagridColDef<MyItem>[]>(() => [
      { headerName: "Descrizione", field: "description", flex: 2, editable: !isLocked },
      { headerName: "Importo", field: "amount", flex: 1, editable: !isLocked,
        cellEditor: "agNumberCellEditor" },
    ], [isLocked]);

    const getNewRow = useCallback((): MyItem => ({
      description: "",
      amount: 0,
    }), []);

    const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<MyItem>>) => {
      if (ref && typeof ref !== 'function') {
        (ref as React.MutableRefObject<GridReadyEvent<DatagridData<MyItem>> | null>).current = event;
      }
    }, [ref]);

    return (
      <Datagrid<MyItem>
        height="300px"
        items={initialItems}
        columnDefs={columnDefs}
        readOnly={isLocked}
        getNewRow={getNewRow}
        onGridReady={handleGridReady}
      />
    );
  }
);

MyDataGrid.displayName = "MyDataGrid";
export default MyDataGrid;
```

---

## Checklist per Nuove Griglie

1. Definire un'interfaccia `T extends Record<string, unknown>` per i dati
2. Usare `DatagridColDef<T>` per le definizioni colonne
3. Usare `DatagridCellValueChangedEvent<T>` (e altri tipi wrappati) per gli eventi
4. Fornire `getNewRow` se la griglia e editabile e si vuole l'auto-add
5. Aggiungere `validationSchema` se servono validazioni inline
6. Usare `hiddenColumnProperties` per colonne ID nascoste
7. Collegare `onGridReady` a un ref se serve accesso ai dati al salvataggio
8. NON importare MAI CSS di AG Grid
9. NON usare MAI `AgGridReact` direttamente
10. NON usare MAI `className="ag-theme-*"`
