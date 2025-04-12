import { useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, RowDoubleClickedEvent, CellKeyDownEvent } from "ag-grid-community";
import { DatagridColDef } from "../../../../@types/searchbox";
import AgGrid from "../../datagrid/AgGrid";
export interface GridResultsProps<T> {
  loading: boolean;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  onSelectedItem: (item: T, event: RowDoubleClickedEvent<T>|CellKeyDownEvent<T>) => void;  
}

function GridResults<T>({ 
  loading, 
  items, 
  columnDefs,
  onSelectedItem,
}: GridResultsProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);

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
    (params: CellKeyDownEvent<T> ) => {
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

  return (
    <AgGrid
      ref={gridRef}
      rowData={items}
      columnDefs={columnDefs as unknown as ColDef<T>[]}
      onRowDoubleClicked={handleRowDoubleClicked}
      onCellKeyDown={handleCellKeyDown}
      rowSelection="single"
      loading={loading}
      defaultColDef={{
        sortable: false,
      }}
    />
  );
}

export default GridResults;
