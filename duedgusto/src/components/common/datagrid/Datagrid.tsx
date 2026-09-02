import { ReactNode, useCallback, useMemo, useRef, useState, useEffect } from "react";
import { CellEditingStartedEvent, CellEditingStoppedEvent, CellValueChangedEvent, Column, GetRowIdParams, GridReadyEvent, IRowNode, RowPinnedType, RowSelectionOptions, SelectionChangedEvent } from "ag-grid-community";
import Box from "@mui/material/Box";
import { useMediaQuery, useTheme } from "@mui/material";
import { z } from "zod";

import AgGrid from "./AgGrid";
import DatagridToolbar from "./DatagridToolbar";
import getFirstEditableColumn from "./getFirstEditableColumn";
import { DatagridAgGridProps, DatagridAuxData, DatagridColDef, DatagridData, IRowEvent, ValidationError } from "../../common/datagrid/@types/Datagrid";
import { DatagridStatus } from "../../../common/globals/constants";
import useEditingState from "./editing/useEditingState";
import useZodValidation from "./validation/useZodValidation";
import useTabNavigation from "./navigation/useTabNavigation";
import { findNextEditableCell } from "./navigation/editableCells";
import useEnterNavigation from "./navigation/useEnterNavigation";
import createRowNumberColumn from "./columns/createRowNumberColumn";
import DateCellEditor from "./cellEditors/date/DateCellEditor";
import SelectCellEditor from "./cellEditors/select/SelectCellEditor";

/** Editor di serie di AG Grid rimpiazzati da versioni che non rompono la navigazione da tastiera. */
const REPLACED_CELL_EDITORS: Record<string, React.ComponentType<never> | undefined> = {
  agDateStringCellEditor: DateCellEditor,
  agSelectCellEditor: SelectCellEditor,
};
import { withDatagridStatus } from "./datagridUtils";
import useGridStatePersistence from "./persistence/useGridStatePersistence";
import { getGridColumnState } from "../../../common/ui/gridStateStorage";

interface BaseDatagridProps<T extends object> extends Omit<DatagridAgGridProps<T>, "rowData" | "columnDefs"> {
  height: string;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  gridId?: string;
  addNewRowAt?: "top" | "bottom";
  showRowNumbers?: boolean;
  hideToolbar?: boolean;
  additionalToolbarButtons?: ReactNode;
  validationSchema?: z.ZodSchema<T>;
  onValidationErrors?: (errors: Map<number, ValidationError[]>) => void;
  onRowsDeleted?: (deletedRows: DatagridData<T>[]) => void;
  /**
   * Chiamata quando il Tab esce dall'ultima cella editabile e la griglia non
   * aggiunge righe. Serve a passare l'editing alla griglia successiva: senza,
   * il focus finisce sul primo campo che capita dopo nel DOM.
   */
  onExitGrid?: () => void;
}

interface NormalModeProps<T extends object> extends BaseDatagridProps<T> {
  presentation?: undefined;
  getNewRow?: () => T;
  readOnly: boolean;
  /**
   * Tab sull'ultima cella aggiunge una riga. Di serie vale per ogni griglia che
   * sappia costruire una riga nuova; va spento dove le righe sono un elenco
   * fisso, altrimenti il Tab finale sforna righe che nessuno può compilare.
   */
  autoAddRowOnTab?: boolean;
}

interface PresentationModeProps<T extends object> extends BaseDatagridProps<T> {
  presentation: true;
  getNewRow?: never;
  readOnly?: never;
  autoAddRowOnTab?: never;
}

type DatagridProps<T extends object> = NormalModeProps<T> | PresentationModeProps<T>;

const initialStatus: DatagridAuxData = {
  status: DatagridStatus.Unchanged,
};

/**
 * Quanto vale ancora, dopo la chiusura dell'editing, la cella da cui ripartire.
 * AG Grid chiude l'editing appena il focus esce (stopEditingWhenCellsLoseFocus),
 * quindi al momento del focusout l'editing risulta gia finito.
 */
const EDITING_MEMORY_MS = 400;

/** Un focus arrivato subito dopo un tocco e dell'utente, non della tastiera. */
const POINTER_GRACE_MS = 500;

function Datagrid<T extends object>(props: DatagridProps<T>) {
  const muiTheme = useTheme();
  const isSmallScreen = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const isMobile = isSmallScreen && navigator.maxTouchPoints > 0;

  const [canAddNewRow, setCanAddNewRow] = useState(true);
  const [hasSelectedRow, setHasSelectedRow] = useState(false);
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
    gridId,
    showRowNumbers = true,
    hideToolbar = false,
    additionalToolbarButtons,
    validationSchema,
    onValidationErrors,
    onRowsDeleted,
    columnDefs,
    onGridReady: onGridReadyProp,
    onExitGrid,
    autoAddRowOnTab: autoAddRowOnTabProp,
    getRowId,
    ...gridProps
  } = props;

  const isPresentation = presentation === true;

  // Safe extraction of conditional props
  const readOnly = !isPresentation ? readOnlyProp : false;
  const getNewRow = !isPresentation ? getNewRowProp : undefined;

  const enableAutoAddRowOnTab = !!getNewRow && autoAddRowOnTabProp !== false;

  // Hooks per gestione editing e validazione
  const { handleCellEditingStarted: trackEditingStarted, handleCellEditingStopped: trackEditingStopped } = useEditingState<T>((isEditing) => {
    setCanAddNewRow(!isEditing);
    isEditingRef.current = isEditing;
  });

  // Ultima cella aperta in editing e istante in cui l'editing e finito: servono a
  // sapere da dove ripartire quando il focus lascia la griglia senza passare da
  // un evento tastiera (vedi handleGridBlur).
  const lastEditingCellRef = useRef<{ rowIndex: number; colId: string } | null>(null);
  const editingStoppedAtRef = useRef(0);
  const pointerDownAtRef = useRef(0);

  const handleCellEditingStarted = useCallback(
    (event: CellEditingStartedEvent<DatagridData<T>>) => {
      if (event.node.rowIndex !== null && !event.node.rowPinned) {
        lastEditingCellRef.current = { rowIndex: event.node.rowIndex, colId: event.column.getColId() };
      }
      trackEditingStarted(event);
    },
    [trackEditingStarted]
  );

  const handleCellEditingStopped = useCallback(
    (event: CellEditingStoppedEvent<DatagridData<T>>) => {
      editingStoppedAtRef.current = Date.now();
      trackEditingStopped(event);
    },
    [trackEditingStopped]
  );

  useEffect(() => {
    const handlePointerDown = () => {
      pointerDownAtRef.current = Date.now();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  const { validateRow } = useZodValidation<T>({ schema: validationSchema });

  // Traccia la GridApi per l'hook di persistenza
  const [gridApi, setGridApi] = useState<GridReadyEvent<DatagridData<T>>["api"] | null>(null);

  // Hook per persistenza stato colonne (registra event listener quando api è disponibile)
  useGridStatePersistence({ gridId, api: gridApi });

  const handleGridReady = useCallback(
    (event: GridReadyEvent<DatagridData<T>>) => {
      gridRef.current = event;
      setGridApi(event.api);

      // Ripristina lo stato colonne salvato dopo che la griglia è pronta
      if (gridId) {
        const savedState = getGridColumnState(gridId);
        if (savedState) {
          event.api.applyColumnState({ state: savedState, applyOrder: true });
        }
      }

      onGridReadyProp?.(event);
    },
    [onGridReadyProp, gridId]
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
          // Se la cella è già in editing non rifare setFocusedCell: sposterebbe il focus
          // DOM dall'input dell'editor al wrapper della cella, lasciando l'editor aperto
          // ma senza cursore (chiamate duplicate da useTabNavigation/useEnterNavigation)
          const colId = typeof colIdOrColumn === "string" ? colIdOrColumn : colIdOrColumn.getColId();
          const alreadyEditing = gridRef.current.api
            .getEditingCells()
            .some((cell) => cell.rowIndex === rowIndex && cell.column.getColId() === colId && (cell.rowPinned ?? null) === (rowPinned ?? null));
          if (alreadyEditing) {
            resolve(true);
            return;
          }
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
      };

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
    },
    [getNewRow, gotoEditCell, handleInsertSingleRow]
  );

  const handleAddNewRow = useCallback(() => {
    if (!gridRef.current) return;
    const node = handleAddNewRowAt(addNewRowAt === "top" ? 0 : undefined);
    return node;
  }, [addNewRowAt, handleAddNewRowAt]);

  /**
   * Sposta l'editing dopo la cella data. Unico punto in cui si decide dove si va:
   * ci passano il Tab, l'Invio su mobile e il focus che scappa dalla griglia.
   *
   * `fromKeyboard` distingue il Tab vero: lì lo spostamento sulla cella
   * successiva sa già farlo AG Grid (salta da sé le colonne non editabili), e
   * rifarlo qui aprirebbe l'editing due volte.
   */
  const navigateFromCell = useCallback(
    (rowIndex: number, colId: string, options: { fromKeyboard: boolean }) => {
      const api = gridRef.current?.api;
      if (!api || readOnly) return false;

      const next = findNextEditableCell(api, rowIndex, colId);
      if (next) {
        if (options.fromKeyboard) return false;
        gotoEditCell(next.rowIndex, next.column);
        return true;
      }

      // Da qui in giù: era l'ultima cella editabile della griglia. In entrambi i
      // rami il focus lascia la cella corrente, quindi la memoria va azzerata o
      // il focusout che segue rifarebbe lo stesso salto una seconda volta.
      if (enableAutoAddRowOnTab) {
        lastEditingCellRef.current = null;
        handleAddNewRowAt(addNewRowAt === "top" ? 0 : undefined);
        return true;
      }

      if (onExitGrid) {
        lastEditingCellRef.current = null;
        api.stopEditing();
        onExitGrid();
        return true;
      }

      return false;
    },
    [readOnly, gotoEditCell, enableAutoAddRowOnTab, handleAddNewRowAt, addNewRowAt, onExitGrid]
  );

  /**
   * Il tasto "avanti" (->) delle tastiere mobile non manda un Tab: Chrome sposta
   * da se il focus al prossimo campo del documento, quindi AG Grid non vede
   * niente e si finisce fuori dalla griglia - in gestione cassa, dritti sulle
   * Note. Qui si intercetta quel salto e si riporta l'editing dove doveva andare.
   *
   * Un focus partito da un tocco non va toccato: se l'utente ha scelto lui dove
   * andare, riportarlo indietro sarebbe peggio del bug.
   */
  const handleGridBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const cell = lastEditingCellRef.current;
      if (!cell || readOnly) return;

      const nextTarget = event.relatedTarget as HTMLElement | null;
      if (!nextTarget || event.currentTarget.contains(nextTarget)) return;

      const now = Date.now();
      if (now - pointerDownAtRef.current < POINTER_GRACE_MS) return;
      if (!isEditingRef.current && now - editingStoppedAtRef.current > EDITING_MEMORY_MS) return;

      lastEditingCellRef.current = null;
      navigateFromCell(cell.rowIndex, cell.colId, { fromKeyboard: false });
    },
    [readOnly, navigateFromCell]
  );

  // Hook per navigazione Tab
  const { handleCellKeyDown: handleTabNavigation } = useTabNavigation<T>({ navigateFromCell });

  // Hook per navigazione Enter su mobile (Enter → prossima cella editabile)
  const { handleEnterNavigation } = useEnterNavigation<T>({ isMobile, navigateFromCell });

  // Verifica se una riga è uguale a newRow (non modificata)
  const isRowPristine = useCallback(
    (rowData: DatagridData<T> | undefined): boolean => {
      if (!rowData || !getNewRow) return false;

      const newRowTemplate = getNewRow();

      // Confronta tutti i campi (escludendo status che è un campo ausiliario).
      // Unico cast: Object.keys restituisce string[] per limite noto di lib.d.ts.
      return (Object.keys(newRowTemplate) as Array<keyof T & string>)
        .filter((key) => key !== "status")
        .every((key) => rowData[key] === newRowTemplate[key]);
    },
    [getNewRow]
  );

  // Handler per keydown esteso: gestisce Tab navigation + ESC per cancellare righe pristine
  const handleCellKeyDown = useCallback(
    (event: Parameters<NonNullable<DatagridAgGridProps<T>["onCellKeyDown"]>>[0]) => {
      // Prima gestisce la navigazione Tab e Enter (solo per CellKeyDownEvent)
      if (event.type === "cellKeyDown" && "column" in event) {
        handleTabNavigation(event);
        handleEnterNavigation(event);
      }

      const keyboardEvent = event.event as KeyboardEvent | undefined;
      if (!keyboardEvent) return;

      // ArrowUp/ArrowDown durante editing in agNumberCellEditor → naviga alla cella sopra/sotto
      if ((keyboardEvent.key === "ArrowUp" || keyboardEvent.key === "ArrowDown") && "column" in event && event.column) {
        const colDef = event.column.getColDef();
        if (colDef.cellEditor === "agNumberCellEditor" && event.api.getEditingCells().length > 0) {
          const currentRowIndex = event.node.rowIndex;
          if (currentRowIndex === null) return;

          const direction = keyboardEvent.key === "ArrowUp" ? -1 : 1;
          const targetRowIndex = currentRowIndex + direction;

          if (targetRowIndex < 0 || targetRowIndex >= event.api.getDisplayedRowCount()) return;

          const targetNode = event.api.getDisplayedRowAtIndex(targetRowIndex);
          if (!targetNode || targetNode.rowPinned) return;

          event.api.stopEditing();
          const colId = event.column.getColId();
          event.api.setFocusedCell(targetRowIndex, colId);

          if (event.column.isCellEditable(targetNode)) {
            setTimeout(() => {
              event.api.startEditingCell({ rowIndex: targetRowIndex, colKey: colId });
            }, 1);
          }
        }
      }

      // Se è ESC e NON si è in editing, verifica se cancellare la riga
      if (keyboardEvent.key === "Escape" && !isEditingRef.current && !readOnly && getNewRow) {
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
    [handleTabNavigation, handleEnterNavigation, isEditingRef, readOnly, getNewRow, isRowPristine]
  );

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent<DatagridData<T>>) => {
    setHasSelectedRow(event.api.getSelectedRows().length > 0);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!gridRef.current || isPresentation) return;
    const selected = gridRef.current.api.getSelectedRows();
    if (selected.length === 0) return;
    gridRef.current.api.applyTransaction({ remove: selected });
    onRowsDeleted?.(selected);
  }, [isPresentation, onRowsDeleted]);

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
    // I literal deprecati "single"/"multiple" ricadono nel default sottostante
    if (typeof props.rowSelection === "object") {
      return props.rowSelection;
    }
    if (!isPresentation && !readOnly) {
      return { mode: "singleRow" };
    }
    return undefined;
  }, [isPresentation, readOnly, props.rowSelection]);

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
      const candidate = withDatagridStatus(item, initialStatus.status);
      // Usa getRowId per ottenere l'ID della riga (se definito nelle props).
      // Cast documentato: params parziale senza api/level (pattern già in uso).
      const rowId = getRowId?.({ data: candidate } as GetRowIdParams<DatagridData<T>>);
      const currentStatus = rowId ? currentStatuses.get(rowId) : undefined;

      // Preserva lo status esistente, altrimenti usa Unchanged
      return currentStatus ? { ...candidate, status: currentStatus } : candidate;
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

  const enhancedColumnDefs = useMemo<DatagridColDef<T>[]>(() => {
    type SuppressParams = Parameters<NonNullable<DatagridColDef<T>["suppressKeyboardEvent"]>>[0];

    const cols = columnDefs.map((rawCol) => {
      // Sostituzioni centralizzate degli editor di serie, così valgono per ogni
      // griglia senza toccare i singoli call site:
      // - data: quello di serie lascia il focus fuori dall'input, il Tab cammina
      //   fra i segmenti e finisce fuori dalla griglia;
      // - tendina: quello di serie chiude l'editing alla selezione, così il Tab
      //   successivo non apre in editing la cella dopo.
      const replacementEditor = REPLACED_CELL_EDITORS[rawCol.cellEditor as string];
      const col: DatagridColDef<T> = replacementEditor ? { ...rawCol, cellEditor: replacementEditor } : rawCol;

      const originalSuppress = col.suppressKeyboardEvent;
      const isNumberEditor = col.cellEditor === "agNumberCellEditor";

      // Sopprime ArrowUp/ArrowDown per agNumberCellEditor + Enter su mobile per tutte le celle editabili
      if (isNumberEditor || isMobile) {
        return {
          ...col,
          suppressKeyboardEvent: (params: SuppressParams) => {
            // ArrowUp/ArrowDown durante editing in agNumberCellEditor → gestito da handleCellKeyDown
            if (isNumberEditor && params.editing && (params.event.key === "ArrowUp" || params.event.key === "ArrowDown")) {
              params.event.preventDefault();
              return true;
            }
            // Enter su mobile durante editing → gestito da useEnterNavigation
            if (isMobile && params.editing && params.event.key === "Enter") {
              return true;
            }
            return originalSuppress ? originalSuppress(params) : false;
          },
        };
      }
      return col;
    });

    if (isPresentation || !showRowNumbers) {
      return cols;
    }
    return [createRowNumberColumn<T>(), ...cols];
  }, [columnDefs, isPresentation, showRowNumbers, isMobile]);

  const context = useRef({
    getGridData,
    gotoEditCell,
  });

  return (
    <Box
      sx={{ height, display: "flex", flexDirection: "column" }}
      onBlur={handleGridBlur}
    >
      {!isPresentation && (!hideToolbar || additionalToolbarButtons) && (
        <DatagridToolbar
          canAddNewRow={canAddNewRow}
          readOnly={readOnly}
          hasSelectedRow={hasSelectedRow}
          hideStandardButtons={hideToolbar}
          gridRef={gridRef}
          onAdd={handleAddNewRow}
          onDelete={handleDeleteSelected}
          additionalButtons={additionalToolbarButtons}
        />
      )}
      <Box
        sx={{ flex: 1 }}
        className="datagrid-root"
      >
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
          onSelectionChanged={handleSelectionChanged}
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
