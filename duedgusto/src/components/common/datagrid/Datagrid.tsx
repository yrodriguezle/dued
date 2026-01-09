import { useCallback, useMemo, useRef, useState } from "react";
import { CellValueChangedEvent, Column, GridReadyEvent, IRowNode, RowPinnedType, RowSelectionOptions } from "ag-grid-community";
import Box from "@mui/material/Box";
import { z } from "zod";

import AgGrid from "./AgGrid";
import DatagridToolbar from "./DatagridToolbar";
import getFirstEditableColumn from "./getFirstEditableColumn";
import { DatagridAgGridProps, DatagridAuxData, DatagridColDef, DatagridData, IRowEvent, ValidationError } from "../../common/datagrid/@types/Datagrid";
import { DatagridStatus } from "../../../common/globals/constants";
import useEditingState from "./editing/useEditingState";
import useZodValidation from "./validation/useZodValidation";
import useTabNavigation from "./navigation/useTabNavigation";
import createRowNumberColumn from "./columns/createRowNumberColumn";

interface BaseDatagridProps<T extends Record<string, unknown>> extends Omit<DatagridAgGridProps<DatagridData<T>>, "rowData" | "columnDefs"> {
  height: string;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  addNewRowAt?: "top" | "bottom";
  showRowNumbers?: boolean;
  hideToolbar?: boolean;
  autoAddRowOnTab?: boolean;
  validationSchema?: z.ZodSchema<T>;
  onValidationErrors?: (errors: Map<number, ValidationError[]>) => void;
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
  status: DatagridStatus.Unchanged,
};

function Datagrid<T extends Record<string, unknown>>(props: DatagridProps<T>) {
  const [canAddNewRow, setCanAddNewRow] = useState(true);
  const gridRef = useRef<GridReadyEvent<DatagridData<T>> | null>(null);

  // Extract all custom props that are NOT part of AG Grid's API
  const {
    addNewRowAt,
    presentation,
    readOnly: readOnlyProp,
    getNewRow: getNewRowProp,
    items,
    height,
    showRowNumbers = true,
    hideToolbar = false,
    autoAddRowOnTab,
    validationSchema,
    onValidationErrors,
    columnDefs,
    onGridReady: onGridReadyProp,
    ...gridProps
  } = props;

  const isPresentation = presentation === true;

  // Safe extraction of conditional props
  const readOnly = !isPresentation ? readOnlyProp : false;
  const getNewRow = !isPresentation ? getNewRowProp : undefined;

  // autoAddRowOnTab è true solo se getNewRow è definito e autoAddRowOnTab non è esplicitamente false
  const enableAutoAddRowOnTab = autoAddRowOnTab !== false && !!getNewRow;

  // Hooks per gestione editing e validazione
  const { handleCellEditingStarted, handleCellEditingStopped } = useEditingState<T>((isEditing) => {
    setCanAddNewRow(!isEditing);
  });

  const { validateRow } = useZodValidation<T>({ schema: validationSchema });

  const handleGridReady = useCallback(
    (event: GridReadyEvent<DatagridData<T>>) => {
      gridRef.current = event;
      onGridReadyProp?.(event);
    },
    [onGridReadyProp]
  );

  const gotoEditCell = useCallback(
    (rowIndex: number, colIdOrColumn: string | Column, rowPinned?: RowPinnedType) =>
      new Promise<boolean>((resolve) => {
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
    []
  );

  const handleInsertSingleRow = useCallback((rowData: DatagridData<T>, addIndex?: number): IRowNode<DatagridData<T>> => {
    if (!gridRef.current) throw new Error("Grid is not ready");
    const rowNode = gridRef.current.api.applyTransaction({ add: [rowData], addIndex });
    if (!rowNode) throw new Error("RowNode is null or undefined");
    return rowNode.add[0];
  }, []);

  const handleAddNewRowAt = useCallback(
    (index: number | undefined) => {
      if (!getNewRow || !gridRef.current) return;
      const baseNewRow = getNewRow();
      const newRowData: DatagridData<T> = {
        ...baseNewRow,
        ...initialStatus,
      } as DatagridData<T>;

      gridRef.current.api.stopEditing();
      const node = handleInsertSingleRow(newRowData, index);

      setCanAddNewRow(false);

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

  // Hook per navigazione Tab (dipende da handleAddNewRowAt e gotoEditCell)
  const { handleCellKeyDown } = useTabNavigation<T>({
    getNewRow,
    onAddRow: handleAddNewRowAt,
    gotoEditCell,
    autoAddRowOnTab: enableAutoAddRowOnTab,
  });

  const handleDeleteSelected = useCallback(() => {
    if (!gridRef.current || isPresentation) return;
    const selected = gridRef.current.api.getSelectedRows() as DatagridData<T>[];
    if (selected.length === 0) return;
    gridRef.current.api.applyTransaction({ remove: selected });
  }, [isPresentation]);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<DatagridData<T>>) => {
      // Ignora cambiamenti alla colonna status
      if (event.column.getColId() === "status" || event.newValue === event.oldValue) {
        return;
      }

      const { data, node } = event;
      if (!data) return;

      // Marca la riga come modificata
      data.status = DatagridStatus.Modified;

      // Esegui validazione se schema presente
      if (validationSchema) {
        const errors = validateRow(node);
        if (errors && onValidationErrors) {
          const errorMap = new Map([[node.rowIndex ?? 0, errors]]);
          onValidationErrors(errorMap);
        }
      }

      // Chiama l'handler parent se fornito
      if (props.onCellValueChanged) {
        props.onCellValueChanged(event);
      }
    },
    [validationSchema, validateRow, onValidationErrors, props]
  );

  const rowSelection = useMemo<RowSelectionOptions<DatagridData<T>> | undefined>(() => {
    if (!isPresentation && !readOnly) {
      return { mode: "singleRow" };
    }
    return undefined;
  }, [isPresentation, readOnly]);

  const rowData = useMemo<DatagridData<T>[]>(
    () =>
      items.map((item) => ({
        ...item,
        ...initialStatus,
      })),
    [items]
  );

  const getGridData = useCallback(() => {
    if (!gridRef.current) return [] as DatagridData<T>[];
    const gridData: DatagridData<T>[] = [];
    gridRef.current?.api.forEachNode((node) => {
      if (!node?.data) {
        return;
      }
      gridData.push(node.data);
    });
    return gridData;
  }, []);

  // Inietta la colonna numero riga se necessario
  const enhancedColumnDefs = useMemo<DatagridColDef<T>[]>(() => {
    if (isPresentation || !showRowNumbers) {
      return columnDefs;
    }
    return [createRowNumberColumn<T>(), ...columnDefs];
  }, [columnDefs, isPresentation, showRowNumbers]);

  const context = useRef({
    getGridData,
    gotoEditCell,
  });

  return (
    <Box sx={{ height, display: "flex", flexDirection: "column" }}>
      {!isPresentation && !hideToolbar && <DatagridToolbar canAddNewRow={canAddNewRow} readOnly={readOnly} gridRef={gridRef} onAdd={handleAddNewRow} onDelete={handleDeleteSelected} />}
      <Box sx={{ flex: 1 }} className="datagrid-root">
        <AgGrid<DatagridData<T>>
          rowSelection={rowSelection}
          singleClickEdit={!isPresentation}
          suppressClickEdit={isPresentation}
          readOnlyEdit={isPresentation}
          onCellEditingStarted={handleCellEditingStarted}
          onCellEditingStopped={handleCellEditingStopped}
          onCellKeyDown={handleCellKeyDown}
          onCellValueChanged={handleCellValueChanged}
          columnDefs={enhancedColumnDefs}
          rowData={rowData}
          onGridReady={handleGridReady}
          context={context.current}
          {...gridProps}
        />
      </Box>
    </Box>
  );
}

export default Datagrid;
