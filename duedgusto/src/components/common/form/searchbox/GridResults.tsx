import { useCallback, useMemo, useRef } from "react";
import type { ColDef, RowDoubleClickedEvent, CellKeyDownEvent, GridReadyEvent, RowSelectionOptions, RowSelectedEvent } from "ag-grid-community";
import { DatagridColDef } from "../../../../@types/searchbox";
import AgGrid from "../../datagrid/AgGrid";
export interface GridResultsProps<T> {
  loading: boolean;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  onSelectedItem: (item: T, event: RowDoubleClickedEvent<T> | CellKeyDownEvent<T>) => void;
  onGridReady: (event: GridReadyEvent<T>) => void;
}

function GridResults<T>({
  loading,
  items,
  columnDefs,
  onSelectedItem,
  onGridReady,
}: GridResultsProps<T>) {
  const gridRef = useRef<GridReadyEvent<T>>(null);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<T>) => {
      gridRef.current = event;
      onGridReady(event);
    },
    [onGridReady],
  );

  const handleRowSelected = useCallback((params: RowSelectedEvent<T>) => {
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
    (params: RowDoubleClickedEvent<T>) => {
      if (!params.data) {
        return;
      }
      onSelectedItem(params.data, params);
    },
    [onSelectedItem],
  );

  const handleCellKeyDown = useCallback(
    (params: CellKeyDownEvent<T>) => {
      if (!params.data || !params.event) {
        return;
      }
      const keyboardEvent = params.event as KeyboardEvent;
      if (keyboardEvent.key === "Enter" && params.data) {
        onSelectedItem(params.data, params);
      }
    },
    [onSelectedItem],
  );

  const rowSelection = useMemo<RowSelectionOptions | "single" | "multiple">(() => {
    return {
      mode: "singleRow",
      checkboxes: false,
      enableClickSelection: true,
    };
  }, []);

  return (
    <AgGrid
      rowData={items}
      columnDefs={columnDefs as unknown as ColDef<T>[]}
      onRowSelected={handleRowSelected}
      onRowDoubleClicked={handleRowDoubleClicked}
      onCellKeyDown={handleCellKeyDown}
      onGridReady={handleGridReady}
      rowSelection={rowSelection}
      loading={loading}
      defaultColDef={{
        sortable: false,
      }}
    />
  );
}

export default GridResults;
