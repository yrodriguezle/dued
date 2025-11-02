import { useCallback, useMemo, useRef, useState } from "react";
import { ColDef, Column, GridReadyEvent, IRowNode, RowPinnedType, RowSelectionOptions } from "ag-grid-community";
import { AgGridReactProps } from "ag-grid-react";
import Box from "@mui/material/Box";

import AgGrid from "./AgGrid";
import DatagridToolbar from "./DatagridToolbar";
import getFirstEditableColumn from "./getFirstEditableColumn";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";

interface BaseDatagridProps<T> extends AgGridReactProps<T> {
  height: string;
  items: T[];
  onGridReady?: (event: GridReadyEvent<T>) => void;
  columnDefs: ColDef<T>[];
  addNewRowAt?: "top" | "bottom";
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

function Datagrid<T extends Record<string, unknown>>(props: DatagridProps<T>) {
  const [canAddNewRow, setCanAddNewRow] = useState(true);
  // const [canDeleteRow, setCanDeleteRow] = useState(false);
  const gridRef = useRef<GridReadyEvent<T> | null>(null);
  const { addNewRowAt, presentation, readOnly, items, height, onGridReady, getNewRow, ...gridProps } = props;
  const isPresentation = presentation === true;

  const handleGridReady = useCallback((event: GridReadyEvent<T>) => {
    gridRef.current = event;
    onGridReady?.(event);
  }, [onGridReady]);

  const gotoEditCell = useCallback(
    (rowIndex: number, colIdOrColumn: string | Column, rowPinned?: RowPinnedType) => new Promise<boolean>((resolve) => {
      if (!gridRef.current) throw new Error("Grid is not ready");
      if (rowIndex + 1 > gridRef.current.api.getDisplayedRowCount()) {
        resolve(true);
        return;
      }
      gridRef.current.api.ensureColumnVisible(colIdOrColumn);
      setTimeout(() => {
        if (!gridRef.current) throw new Error("Grid is not ready");
        gridRef.current.api.setFocusedCell(rowIndex, colIdOrColumn, rowPinned);
        gridRef.current.api.startEditingCell({ rowIndex, colKey: colIdOrColumn, rowPinned });
        resolve(true);
      }, 1);
    }),
    [],
  );

  const handleInsertSingleRow = useCallback((rowData: T, addIndex?: number): IRowNode<T> => {
    if (!gridRef.current) throw new Error("Grid is not ready");
    const rowNode = gridRef.current.api.applyTransaction({ add: [rowData], addIndex });
    if (!rowNode) throw new Error("RowNode is null or undefined");
    return rowNode.add[0];
  }, []);

  const handleAddNewRowAt = useCallback((index: number | undefined) => {
    if (!getNewRow || !gridRef.current) return;
    const newRowData = getNewRow?.();
    gridRef.current.api.stopEditing();
    const node = handleInsertSingleRow(newRowData, index);
    setCanAddNewRow(false);
    const rowEvent: IRowEvent<T> = {
      data: newRowData,
      node,
      api: gridRef.current.api,
    };
    const firstEditableColumn = getFirstEditableColumn(rowEvent);
    if (firstEditableColumn) {
      gotoEditCell(node.rowIndex ?? 0, firstEditableColumn);
    }
    return node;

  }, [getNewRow, gotoEditCell, handleInsertSingleRow]);

  const handleAddNewRow = useCallback(() => {
    if (!gridRef.current) return;
    const node = handleAddNewRowAt((addNewRowAt === "top") ? 0 : undefined);
    return node;
  }, [addNewRowAt, handleAddNewRowAt]);

  const handleDeleteSelected = useCallback(() => {
    if (!gridRef.current || isPresentation) return;
    const selected = gridRef.current.api.getSelectedRows();
    if (selected.length === 0) return;
    gridRef.current.api.applyTransaction({ remove: selected });
  }, [isPresentation]);

  const rowSelection = useMemo<"single" | "multiple" | RowSelectionOptions<DatagridData<DatagridData<T>>> | undefined>(() => {
    if (!isPresentation && !readOnly) {
      return "single";
    }
    return undefined;
  }, [isPresentation, readOnly]);


  return (
    <Box sx={{ height, display: "flex", flexDirection: "column" }}>
      {!isPresentation && (
        <DatagridToolbar
          canAddNewRow={canAddNewRow}
          readOnly={readOnly}
          gridRef={gridRef}
          onAdd={handleAddNewRow}
          onDelete={handleDeleteSelected}
        />
      )}
      <Box sx={{ flex: 1 }} className="datagrid-root">
        <AgGrid<DatagridData<T>>
          rowSelection={rowSelection}
          {...gridProps}
          rowData={items}
          onGridReady={handleGridReady}
        />
      </Box>
    </Box>
  );
}

export default Datagrid;
