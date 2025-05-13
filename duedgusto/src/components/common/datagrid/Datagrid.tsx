import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CellEditingStartedEvent, Column, GridReadyEvent, IRowNode, RowPinnedType } from "ag-grid-community";
import Box from "@mui/material/Box";

import AgGrid from "./AgGrid";
import DatagridToolbar from "./DatagridToolbar";
import getFirstEditableColumn from "./getFirstEditableColumn";
import { DatagridData, DatagridProps, IRowEvent } from "./@types/Datagrid";
import { DatagridStatus } from "../../../common/globals/constants";
import { AgGridReactProps } from "ag-grid-react";

function Datagrid<T extends Record<string, unknown>>(props: DatagridProps<T>) {
  const [ready, setReady] = useState(false);
  const [canAddNewRow, setCanAddNewRow] = useState(true);
  // const [canDeleteRow, setCanDeleteRow] = useState(false);
  const [items, setItems] = useState<DatagridData<T>[]>([]);
  const gridRef = useRef<GridReadyEvent<DatagridData<T>> | null>(null);
  const { addNewRowAt, presentation, readOnly, height, onGridReady, getNewRow, ...gridProps } = props;
  const isPresentation = presentation === true;
  const previousEditingNode = useRef<IRowNode<DatagridData<T>>>(null);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<DatagridData<T>>) => {
      gridRef.current = event;
      setReady(true);
      onGridReady?.(event);
    },
    [onGridReady]
  );

  const initRowData = useCallback(() => {
    const pRowData = props.rowData || [];
    setItems(
      pRowData.map((data) => ({
        ...data,
        status: DatagridStatus.Unchanged,
      }))
    );
  }, [props.rowData]);

  const handleCellEditingStarted = useCallback((params: CellEditingStartedEvent) => {
    params.api.deselectAll();
    setCanAddNewRow(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    initRowData();
    gridRef.current?.api.addEventListener("cellEditingStarted", handleCellEditingStarted);
  }, [handleCellEditingStarted, initRowData, ready]);

  const gotoEditCell = useCallback(
    (rowIndex: number, colIdOrColumn: string | Column, rowPinned?: RowPinnedType) =>
      new Promise<boolean>((resolve) => {
        if (!gridRef.current) {
          resolve(false);
          return;
        }
        if (rowIndex + 1 > gridRef.current.api.getDisplayedRowCount()) {
          resolve(true);
          return;
        }
        gridRef.current.api.ensureColumnVisible(colIdOrColumn);
        setTimeout(() => {
          if (!gridRef.current) {
            resolve(false);
            return;
          }
          gridRef.current.api.setFocusedCell(rowIndex, colIdOrColumn, rowPinned);
          gridRef.current.api.startEditingCell({ rowIndex, colKey: colIdOrColumn, rowPinned });
          resolve(true);
        }, 1);
      }),
    []
  );

  const handleInsertSingleRow = useCallback((rowData: DatagridData<T>, addIndex?: number) => {
    if (!gridRef.current) throw new Error("Grid is not ready");
    const rowNode = gridRef.current.api.applyTransaction({ add: [rowData], addIndex });
    if (!rowNode) throw new Error("RowNode is null or undefined");
    return rowNode.add[0];
  }, []);

  const handleAddNewRowAt = useCallback(
    (index: number | undefined) => {
      if (!getNewRow || !gridRef.current) return;
      const newRowData: DatagridData<T> = {
        ...(getNewRow?.() || ({} as T)),
        status: DatagridStatus.Added,
      };
      gridRef.current.api.stopEditing();
      const node = handleInsertSingleRow(newRowData, index);
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
    },
    [getNewRow, gotoEditCell, handleInsertSingleRow]
  );

  const handleAddNewRow = useCallback(() => {
    if (!gridRef.current) return;
    const node = handleAddNewRowAt(addNewRowAt === "top" ? 0 : undefined);
    return node;
  }, [addNewRowAt, handleAddNewRowAt]);

  const handleDeleteSelected = useCallback(() => {
    if (!gridRef.current || isPresentation) return;
    const selected = gridRef.current.api.getSelectedRows();
    if (selected.length === 0) return;
    gridRef.current.api.applyTransaction({ remove: selected });
  }, [isPresentation]);

  const context = useMemo(
    () => ({
      previousEditingNode,
      props,
      onGridReady,
      initRowData,
      gotoEditCell,
    }),
    [gotoEditCell, initRowData, onGridReady, props]
  );

  return (
    <Box sx={{ height, display: "flex", flexDirection: "column" }}>
      {!isPresentation && <DatagridToolbar readOnly={readOnly} gridRef={gridRef} canAddNewRow={canAddNewRow} onAdd={handleAddNewRow} onDelete={handleDeleteSelected} />}
      <Box sx={{ flex: 1 }} className="datagrid-root">
        <AgGrid context={context} {...(gridProps as AgGridReactProps<DatagridData<T>>)} rowData={items} onGridReady={handleGridReady} />
      </Box>
    </Box>
  );
}

export default Datagrid;
