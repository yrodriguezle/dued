import { useCallback, useMemo, useRef } from "react";
import { ColDef, GridReadyEvent, RowSelectionOptions } from "ag-grid-community";
import { AgGridReactProps } from "ag-grid-react";
import Box from "@mui/material/Box";

import AgGrid from "./AgGrid";
import DatagridToolbar from "./DatagridToolbar";

interface BaseDatagridProps<T> extends AgGridReactProps<T> {
  height: string;
  items: T[];
  onGridReady?: (event: GridReadyEvent<T>) => void;
  columnDefs: ColDef<T>[];
}

interface NormalModeProps<T> extends BaseDatagridProps<T> {
  presentation?: undefined;
  getNewRow: () => T;
  readOnly: boolean;
}

interface PresentationModeProps<T> extends BaseDatagridProps<T> {
  presentation: true;
  getNewRow?: never;
  readOnly?: never;
}

type DatagridProps<T> = NormalModeProps<T> | PresentationModeProps<T>;

function Datagrid<T>(props: DatagridProps<T>) {
  // const [canAddNewRow, setCanAddNewRow] = useState(true);
  // const [canDeleteRow, setCanDeleteRow] = useState(false);
  const isPresentation = props.presentation === true;
  const gridRef = useRef<GridReadyEvent<T> | null>(null);
  const { readOnly, items, height, onGridReady, getNewRow, ...gridProps } = props;

  const handleGridReady = useCallback((event: GridReadyEvent<T>) => {
    gridRef.current = event;
    onGridReady?.(event);
  }, [onGridReady]);

  const handleAddRow = useCallback(() => {
    if (!gridRef.current || isPresentation) return;
    const newRow = getNewRow?.();
    if (!newRow) return;
    gridRef.current.api.stopEditing();
    gridRef.current.api.applyTransaction({ add: [newRow] });

  }, [getNewRow, isPresentation]);

  const handleDeleteSelected = useCallback(() => {
    if (!gridRef.current || isPresentation) return;
    const selected = gridRef.current.api.getSelectedRows();
    if (selected.length === 0) return;
    gridRef.current.api.applyTransaction({ remove: selected });
  }, [isPresentation]);

  const rowSelection = useMemo<RowSelectionOptions<T> | undefined>(() => {
    if (!isPresentation && !readOnly) {
      return {
        mode: 'singleRow',
      };
    }
    return undefined;
  }, [isPresentation, readOnly]);


  return (
    <Box sx={{ height, display: "flex", flexDirection: "column" }}>
      {!isPresentation && (
        <DatagridToolbar
          readOnly={readOnly}
          gridRef={gridRef}
          onAdd={handleAddRow}
          onDelete={handleDeleteSelected}
        />
      )}
      <Box sx={{ flex: 1 }} className="datagrid-root">
        <AgGrid
          {...gridProps}
          rowSelection={rowSelection}
          rowData={items}
          onGridReady={handleGridReady}
        />
      </Box>
    </Box>
  );
}

export default Datagrid;
