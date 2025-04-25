/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useMemo, useRef } from "react";
import { ColDef, GridReadyEvent } from "ag-grid-community";
import { AgGridReactProps } from "ag-grid-react";
import Box from "@mui/material/Box";

import AgGrid from "./AgGrid";
import DatagridToolbar from "./DatagridToolbar";

interface DatagridProps<T> extends AgGridReactProps<T> {
  height: string;
  items: T[];
  onGridReady?: (event: GridReadyEvent<T>) => void;
  getNewRow?: () => T;
}

function Datagrid<T>(props: DatagridProps<T>) {
  const gridRef = useRef<GridReadyEvent<T>>(null);
  const { dataGridProps, gridProps } = useMemo(() => {
    const { height, items, onGridReady, getNewRow, ...rest } = props;
    return {
      dataGridProps: {
        items,
        height,
        onGridReady,
        getNewRow,
      },
      gridProps: rest,
    };
  }, [props]);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<T>) => {
      gridRef.current = event;
      dataGridProps.onGridReady?.(event);
    },
    [dataGridProps]
  );

  const handleAddRow = () => {
    if (!gridRef.current || !dataGridProps.getNewRow) return;
    gridRef.current.api.applyTransaction({ add: [dataGridProps.getNewRow()], addIndex: 0 });
  };

  const handleDeleteSelected = () => {
    if (!gridRef.current) return;
    const selected = gridRef.current.api.getSelectedRows();
    if (selected.length === 0) return;
    gridRef.current.api.applyTransaction({ remove: selected });
  };

  return (
    <Box
      sx={{
        height: props.height,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <DatagridToolbar />
      <Box sx={{ flex: 1 }} className="datagrid-root">
        <AgGrid
          {...gridProps}
          onGridReady={handleGridReady}
          rowData={props.items}
          columnDefs={props.columnDefs as unknown as ColDef<T>[]}
        />
      </Box>
    </Box>
  );
}

export default Datagrid;
