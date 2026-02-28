import { useCallback, useMemo, useRef } from "react";
import type { ColDef, RowDoubleClickedEvent, CellKeyDownEvent, GridReadyEvent, RowSelectionOptions } from "ag-grid-community";
import AgGrid from "../../datagrid/AgGrid";
import { DatagridData, DatagridRowSelectedEvent, DatagridRowDoubleClickedEvent, DatagridCellKeyDownEvent, DatagridCellFocusedEvent, DatagridGridReadyEvent } from "../../datagrid/@types/Datagrid";
import { DatagridStatus } from "../../../../common/globals/constants";

export interface GridResultsProps<T extends Record<string, unknown>> {
  loading: boolean;
  items: T[];
  columnDefs: ColDef<T>[];
  onSelectedItem: (item: T, event: RowDoubleClickedEvent<T> | CellKeyDownEvent<T>) => void;
  onGridReady: (event: GridReadyEvent<T>) => void;
}

function GridResults<T extends Record<string, unknown>>({ loading, items, columnDefs, onSelectedItem, onGridReady }: GridResultsProps<T>) {
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

  // Converte ColDef<T> in ColDef<DatagridData<T>> mappando i field
  const wrappedColumnDefs = useMemo(
    () =>
      columnDefs.map((col) => ({
        ...col,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field: col.field as any, // Cast necessario per compatibilità tipi ColDef<T> -> ColDef<DatagridData<T>>
      })),
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
      if (keyboardEvent.key === "Enter" && params.data) {
        // Estrai dati originali rimuovendo il campo status
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status, ...originalData } = params.data;
        onSelectedItem(originalData as unknown as T, params as unknown as CellKeyDownEvent<T>);
      }
    },
    [onSelectedItem]
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columnDefs={wrappedColumnDefs as any} // Cast necessario per compatibilità tipi
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
    />
  );
}

export default GridResults;
