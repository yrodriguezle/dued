import { useCallback, useRef } from "react";
import { ColDef, GridReadyEvent } from "ag-grid-community";
import { AgGridReactProps } from "ag-grid-react";
import AgGrid from "./AgGrid";

interface DatagridProps<T> extends AgGridReactProps<T> {
  items: T[];
  onGridReady?: (event: GridReadyEvent<T>) => void;
}

function Datagrid<T>(props: DatagridProps<T>) {
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
