import { useCallback, useMemo, useRef, useState, useEffect } from "react";
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
  validationSchema?: z.ZodSchema<T>;
  onValidationErrors?: (errors: Map<number, ValidationError[]>) => void;
}

interface NormalModeProps<T extends Record<string, unknown>> extends BaseDatagridProps<T> {
  presentation?: undefined;
  getNewRow?: () => T;
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
  const isEditingRef = useRef(false);
  const previousRowDataRef = useRef<DatagridData<T>[]>([]);

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
    validationSchema,
    onValidationErrors,
    columnDefs,
    onGridReady: onGridReadyProp,
    getRowId,
    ...gridProps
  } = props;

  const isPresentation = presentation === true;

  // Safe extraction of conditional props
  const readOnly = !isPresentation ? readOnlyProp : false;
  const getNewRow = !isPresentation ? getNewRowProp : undefined;

  const enableAutoAddRowOnTab = !!getNewRow;

  // Hooks per gestione editing e validazione
  const { handleCellEditingStarted, handleCellEditingStopped } = useEditingState<T>((isEditing) => {
    setCanAddNewRow(!isEditing);
    isEditingRef.current = isEditing;
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
  const { handleCellKeyDown: handleTabNavigation } = useTabNavigation<T>({
    getNewRow,
    onAddRow: handleAddNewRowAt,
    gotoEditCell,
    autoAddRowOnTab: enableAutoAddRowOnTab,
  });

  // Verifica se una riga è uguale a newRow (non modificata)
  const isRowPristine = useCallback(
    (rowData: DatagridData<T> | undefined): boolean => {
      if (!rowData || !getNewRow) return false;

      const newRowTemplate = getNewRow();

      // Confronta tutti i campi (escludendo status che è un campo ausiliario)
      for (const key in newRowTemplate) {
        if (key === "status") continue;
        if (rowData[key] !== newRowTemplate[key]) {
          return false;
        }
      }
      return true;
    },
    [getNewRow]
  );

  // Handler per keydown esteso: gestisce Tab navigation + ESC per cancellare righe pristine
  const handleCellKeyDown = useCallback(
    (event: Parameters<NonNullable<DatagridAgGridProps<DatagridData<T>>["onCellKeyDown"]>>[0]) => {
      // Prima gestisce la navigazione Tab (solo per CellKeyDownEvent)
      if (event.type === "cellKeyDown" && "column" in event) {
        handleTabNavigation(event as Parameters<typeof handleTabNavigation>[0]);
      }

      // Se è ESC e NON si è in editing, verifica se cancellare la riga
      const keyboardEvent = event.event as KeyboardEvent | undefined;
      if (keyboardEvent?.key === "Escape" && !isEditingRef.current && !readOnly && getNewRow) {
        const focusedCell = event.api.getFocusedCell();
        if (!focusedCell) return;

        const rowNode = event.api.getDisplayedRowAtIndex(focusedCell.rowIndex);
        if (!rowNode?.data) return;

        // Se la riga è pristine (non modificata rispetto a newRow), la rimuove
        if (isRowPristine(rowNode.data)) {
          event.api.applyTransaction({ remove: [rowNode.data] });
          setCanAddNewRow(true);
        }
      }
    },
    [handleTabNavigation, isEditingRef, readOnly, getNewRow, isRowPristine]
  );

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
      event.api.refreshCells({ rowNodes: [node], force: true });

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

  const [rowData, setRowData] = useState<DatagridData<T>[]>([]);
  const itemsStringRef = useRef<string>("");

  // Aggiorna rowData solo quando items cambia effettivamente (non solo riferimento)
  useEffect(() => {
    // Crea una stringa per confronto profondo
    const itemsString = JSON.stringify(items);

    // Se i dati non sono cambiati, non fare nulla
    if (itemsString === itemsStringRef.current) {
      return;
    }

    // Se siamo in editing, non ricalcolare rowData
    if (isEditingRef.current) {
      return;
    }

    // Aggiorna il riferimento
    itemsStringRef.current = itemsString;

    // Crea nuovi dati dagli items, preservando solo lo status dalla griglia esistente
    const currentStatuses = new Map<string, DatagridStatus>();
    if (gridRef.current) {
      gridRef.current.api.forEachNode((node) => {
        if (node.data && node.id) {
          currentStatuses.set(node.id, node.data.status);
        }
      });
    }

    const newRowData = items.map((item) => {
      // Usa getRowId per ottenere l'ID della riga (se definito nelle props)
      const rowId = getRowId?.({ data: item as DatagridData<T> } as Parameters<NonNullable<typeof getRowId>>[0]);
      const currentStatus = rowId ? currentStatuses.get(rowId) : undefined;

      return {
        ...item,
        // Preserva lo status esistente, altrimenti usa Unchanged
        status: currentStatus ?? initialStatus.status,
      };
    });

    previousRowDataRef.current = newRowData;
    setRowData(newRowData);
  }, [items, getRowId]);

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
          {...gridProps}
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
          getRowId={getRowId}
          context={context.current}
        />
      </Box>
    </Box>
  );
}

export default Datagrid;
