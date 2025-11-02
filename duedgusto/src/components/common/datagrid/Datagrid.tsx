import { useCallback, useMemo, useRef, useState } from "react";
import { Column, GridReadyEvent, IRowNode, RowPinnedType, RowSelectionOptions } from "ag-grid-community";
import Box from "@mui/material/Box";

import AgGrid from "./AgGrid";
import DatagridToolbar from "./DatagridToolbar";
import getFirstEditableColumn from "./getFirstEditableColumn";
import { DatagridAgGridProps, DatagridAuxData, DatagridColDef, DatagridData, IRowEvent } from "../../common/datagrid/@types/Datagrid";
import { DatagridStatus } from "../../../common/globals/constants";

interface BaseDatagridProps<T extends Record<string, unknown>> extends Omit<DatagridAgGridProps<DatagridData<T>>, "rowData" | "columnDefs"> {
  height: string;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  addNewRowAt?: "top" | "bottom";
}

interface NormalModeProps<T extends Record<string, unknown>> extends BaseDatagridProps<T> {
  presentation?: undefined;
  getNewRow: () => T;
  readOnly: boolean;
}

interface PresentationModeProps<T extends Record<string, unknown>> extends BaseDatagridProps<T> {
  presentation: true;
  getNewRow?: never;
  readOnly?: never;
}

type DatagridProps<T extends Record<string, unknown>> = NormalModeProps<T> | PresentationModeProps<T>;

const initialStatus: DatagridAuxData = {
  status: DatagridStatus.Unchanged
};

function Datagrid<T extends Record<string, unknown>>(props: DatagridProps<T>) {
  const [canAddNewRow, setCanAddNewRow] = useState(true);
  const gridRef = useRef<GridReadyEvent<DatagridData<T>> | null>(null);

  const { addNewRowAt, presentation, readOnly, items, height, onGridReady, getNewRow, ...gridProps } = props;
  const isPresentation = presentation === true;

  // -> grid ready now typed with DatagridData<T>
  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<T>>) => {
    gridRef.current = event;
    // Propaga l'evento esterno (che, grazie ai tipi del BaseDatagridProps, si aspetta DatagridData<T>)
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

  // -> applyTransaction lavora su DatagridData<T>, quindi accettiamo DatagridData<T>
  const handleInsertSingleRow = useCallback((rowData: DatagridData<T>, addIndex?: number): IRowNode<DatagridData<T>> => {
    if (!gridRef.current) throw new Error("Grid is not ready");
    const rowNode = gridRef.current.api.applyTransaction({ add: [rowData], addIndex });
    if (!rowNode) throw new Error("RowNode is null or undefined");
    return rowNode.add[0];
  }, []);

  const handleAddNewRowAt = useCallback((index: number | undefined) => {
    if (!getNewRow || !gridRef.current) return;
    // -> arricchiamo il nuovo record con lo status prima di inserirlo
    const baseNewRow = getNewRow();
    const newRowData: DatagridData<T> = {
      ...baseNewRow,
      ...initialStatus,
    } as DatagridData<T>;

    gridRef.current.api.stopEditing();
    const node = handleInsertSingleRow(newRowData, index);

    setCanAddNewRow(false);

    // IRowEvent / getFirstEditableColumn devono lavorare su DatagridData<T>
    const rowEvent: IRowEvent<DatagridData<T>> = {
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
    const selected = gridRef.current.api.getSelectedRows() as DatagridData<T>[];
    if (selected.length === 0) return;
    gridRef.current.api.applyTransaction({ remove: selected });
  }, [isPresentation]);

  // -> tipizzato con DatagridData<T>
  const rowSelection = useMemo<"single" | "multiple" | RowSelectionOptions<DatagridData<T>> | undefined>(() => {
    if (!isPresentation && !readOnly) {
      return "single";
    }
    return undefined;
  }, [isPresentation, readOnly]);

  // rowData effettivo (DatagridData<T>[]) — lo passiamo ad AgGrid
  const rowData = useMemo<DatagridData<T>[]>(() => items.map((item) => ({
    ...item,
    ...initialStatus,
  })), [items]);

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
        {/* AgGrid è parametrizzato con DatagridData<T> */}
        <AgGrid<DatagridData<T>>
          rowSelection={rowSelection}
          {...gridProps}
          rowData={rowData}
          onGridReady={handleGridReady}
        />
      </Box>
    </Box>
  );
}

export default Datagrid;
