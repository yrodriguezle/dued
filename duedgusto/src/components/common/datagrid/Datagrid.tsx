import { useCallback, useRef } from "react";
import { ColDef, GridReadyEvent } from "ag-grid-community";
import { DatagridColDef } from "../../../@types/searchbox";
import AgGrid from "./AgGrid";

interface GridResultsProps<T> {
  items: T[];
  columnDefs: DatagridColDef<T>[];
  onGridReady?: (event: GridReadyEvent<T>) => void;
}

function Datagrid<T>(props: GridResultsProps<T>) {
  const gridRef = useRef<GridReadyEvent<T>>(null);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<T>) => {
      gridRef.current = event;
      props.onGridReady?.(event);
    },
    [props]
  );

  return <AgGrid rowData={props.items} columnDefs={props.columnDefs as unknown as ColDef<T>[]} onGridReady={handleGridReady} />;
}

export default Datagrid;
