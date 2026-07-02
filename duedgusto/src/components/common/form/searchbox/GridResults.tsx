import { useCallback, useMemo, useRef } from "react";
import type { RowSelectionOptions } from "ag-grid-community";
import AgGrid from "../../datagrid/AgGrid";
import { DatagridColDef, DatagridData, DatagridRowSelectedEvent, DatagridRowDoubleClickedEvent, DatagridCellKeyDownEvent, DatagridCellFocusedEvent, DatagridGridReadyEvent } from "../../datagrid/@types/Datagrid";
import { withDatagridStatus, stripDatagridStatus } from "../../datagrid/datagridUtils";
import { toDatagridColDef } from "./searchboxUtils";
import { DatagridStatus } from "../../../../common/globals/constants";
import { SearchboxColDef } from "../../../../@types/searchbox";

export interface GridResultsProps<T extends object> {
  loading: boolean;
  items: T[];
  columnDefs: SearchboxColDef<T>[];
  onSelectedItem: (item: T, event: DatagridRowDoubleClickedEvent<T> | DatagridCellKeyDownEvent<T>) => void;
  onGridReady: (event: DatagridGridReadyEvent<T>) => void;
  onNavigateBack?: () => void;
  showNoRowsOverlay?: boolean;
}

function GridResults<T extends object>({ loading, items, columnDefs, onSelectedItem, onGridReady, onNavigateBack, showNoRowsOverlay }: GridResultsProps<T>) {
  const gridRef = useRef<DatagridGridReadyEvent<T> | null>(null);

  // Wrappa i dati con DatagridData aggiungendo lo status ausiliario
  const wrappedItems = useMemo<DatagridData<T>[]>(() => items.map((item) => withDatagridStatus(item, DatagridStatus.Valid)), [items]);

  // Converte SearchboxColDef<T> in DatagridColDef<T> omettendo graphField/action (vedi searchboxUtils)
  const wrappedColumnDefs = useMemo<DatagridColDef<T>[]>(() => columnDefs.map(toDatagridColDef), [columnDefs]);

  const handleGridReady = useCallback(
    (event: DatagridGridReadyEvent<T>) => {
      gridRef.current = event;
      onGridReady(event);
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
      // Estrai i dati originali rimuovendo il campo status ausiliario
      onSelectedItem(stripDatagridStatus(params.data), params);
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
        // Estrai i dati originali rimuovendo il campo status ausiliario
        onSelectedItem(stripDatagridStatus(params.data), params);
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
