import { useCallback, useMemo, useRef } from "react";
import type { ColDef, RowDoubleClickedEvent, CellKeyDownEvent, GridReadyEvent, RowSelectionOptions } from "ag-grid-community";
import AgGrid from "../../datagrid/AgGrid";
import { DatagridData, DatagridRowSelectedEvent, DatagridRowDoubleClickedEvent, DatagridCellKeyDownEvent, DatagridCellFocusedEvent, DatagridGridReadyEvent } from "../../datagrid/@types/Datagrid";
import { DatagridStatus } from "../../../../common/globals/constants";
import { SearchboxColDef } from "../../../../@types/searchbox";

export interface GridResultsProps<T extends Record<string, unknown>> {
  loading: boolean;
  items: T[];
  columnDefs: SearchboxColDef<T>[];
  onSelectedItem: (item: T, event: RowDoubleClickedEvent<T> | CellKeyDownEvent<T>) => void;
  onGridReady: (event: GridReadyEvent<T>) => void;
  onNavigateBack?: () => void;
  showNoRowsOverlay?: boolean;
}

function GridResults<T extends Record<string, unknown>>({ loading, items, columnDefs, onSelectedItem, onGridReady, onNavigateBack, showNoRowsOverlay }: GridResultsProps<T>) {
  const gridRef = useRef<DatagridGridReadyEvent<T> | null>(null);

  // Wrapper i dati con DatagridData
  const wrappedItems = useMemo<DatagridData<T>[]>(
    () =>
      items.map(
        (item) =>
          ({
            ...item,
            status: DatagridStatus.Valid,
          }) as DatagridData<T>
      ),
    [items]
  );

  // Converte SearchboxColDef<T> in ColDef<DatagridData<T>> per AgGrid.
  // graphField e action sono campi searchbox-specifici non presenti in ColDef — vengono omessi.
  // Il cast via unknown è necessario al boundary T → DatagridData<T>: tutte le callback di AG Grid
  // (valueGetter, cellRenderer, ecc.) sono parametrizzate in T, ma DatagridData<T> = T & DatagridAuxData
  // è compatibile a runtime. Non è possibile esprimere questa covarianza strutturalmente in TypeScript
  // senza un'asserzione esplicita a questo boundary.
  const wrappedColumnDefs = useMemo<ColDef<DatagridData<T>>[]>(
    () =>
      columnDefs.map((col) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { graphField: _g, action: _a, ...rest } = col;
        return rest as unknown as ColDef<DatagridData<T>>;
      }),
    [columnDefs]
  );

  const handleGridReady = useCallback(
    (event: DatagridGridReadyEvent<T>) => {
      gridRef.current = event;
      // Cast event per callback che si aspetta GridReadyEvent<T>
      onGridReady(event as unknown as GridReadyEvent<T>);
    },
    [onGridReady]
  );

  const handleRowSelected = useCallback((params: DatagridRowSelectedEvent<T>) => {
    const lastFocusedCell = params.api.getFocusedCell();
    if (!lastFocusedCell) {
      const [node] = params.api.getSelectedNodes();
      if (node && node.rowIndex !== undefined) {
        const [firstColum] = params.api.getAllDisplayedColumns();
        const colId = firstColum && firstColum.getColId();
        if (!colId) return;
        params.api.setFocusedCell(node.rowIndex as number, colId);
      }
    }
  }, []);

  const handleRowDoubleClicked = useCallback(
    (params: DatagridRowDoubleClickedEvent<T>) => {
      if (!params.data) {
        return;
      }
      // Estrai dati originali rimuovendo il campo status
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { status, ...originalData } = params.data;
      onSelectedItem(originalData as unknown as T, params as unknown as RowDoubleClickedEvent<T>);
    },
    [onSelectedItem]
  );

  const handleCellKeyDown = useCallback(
    (params: DatagridCellKeyDownEvent<T>) => {
      if (!params.data || !params.event) {
        return;
      }
      const keyboardEvent = params.event as KeyboardEvent;
      if (keyboardEvent.key === "ArrowUp" && params.rowIndex === 0 && onNavigateBack) {
        keyboardEvent.preventDefault();
        onNavigateBack();
        return;
      }
      if (keyboardEvent.key === "Enter" && params.data) {
        // Estrai dati originali rimuovendo il campo status
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status, ...originalData } = params.data;
        onSelectedItem(originalData as unknown as T, params as unknown as CellKeyDownEvent<T>);
      }
    },
    [onNavigateBack, onSelectedItem]
  );

  const handleCellFocused = useCallback((params: DatagridCellFocusedEvent<T>) => {
    if (params.rowIndex !== null && params.rowIndex !== undefined) {
      const node = params.api.getDisplayedRowAtIndex(params.rowIndex);
      if (node) {
        node.setSelected(true);
      }
    }
  }, []);

  const rowSelection = useMemo<RowSelectionOptions | "single" | "multiple">(() => {
    return {
      mode: "singleRow",
      checkboxes: false,
      enableClickSelection: true,
    };
  }, []);

  return (
    <AgGrid
      rowData={wrappedItems}
      columnDefs={wrappedColumnDefs}
      onRowSelected={handleRowSelected}
      onRowDoubleClicked={handleRowDoubleClicked}
      onCellKeyDown={handleCellKeyDown}
      onCellFocused={handleCellFocused}
      onGridReady={handleGridReady}
      rowSelection={rowSelection}
      loading={loading}
      defaultColDef={{
        sortable: false,
        suppressMovable: true,
      }}
      overlayNoRowsTemplate={showNoRowsOverlay ? "Nessun risultato trovato" : undefined}
    />
  );
}

export default GridResults;
