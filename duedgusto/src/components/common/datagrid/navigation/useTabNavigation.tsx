import { useCallback } from "react";
import { CellKeyDownEvent, Column, GridApi, IRowNode, RowPinnedType } from "ag-grid-community";
import { DatagridData } from "../@types/Datagrid";

interface UseTabNavigationProps<T extends Record<string, unknown>> {
  getNewRow?: () => T;
  onAddRow?: (index?: number) => IRowNode<DatagridData<T>> | undefined;
  gotoEditCell?: (rowIndex: number, col: string | Column, rowPinned?: RowPinnedType) => Promise<boolean>;
  autoAddRowOnTab?: boolean;
}

interface UseTabNavigationReturn {
  handleCellKeyDown: (event: CellKeyDownEvent) => void;
}

function useTabNavigation<T extends Record<string, unknown>>(props: UseTabNavigationProps<T>): UseTabNavigationReturn {
  const { getNewRow, onAddRow, gotoEditCell, autoAddRowOnTab = true } = props;

  const isLastEditableCell = useCallback((api: GridApi, rowIndex: number, column: Column): boolean => {
    const totalRows = api.getDisplayedRowCount();
    const isLastRow = rowIndex === totalRows - 1;

    if (!isLastRow) {
      return false;
    }

    // Ottiene tutte le colonne editabili dopo la colonna corrente
    const allColumns = api.getAllDisplayedColumns();
    const currentColIndex = allColumns.findIndex((col) => col.getColId() === column.getColId());

    const remainingCols = allColumns.slice(currentColIndex + 1);
    const node = api.getDisplayedRowAtIndex(rowIndex);

    if (!node) {
      return true;
    }

    const hasEditableAfter = remainingCols.some((col) => col.isCellEditable(node));

    return !hasEditableAfter;
  }, []);

  const getFirstEditableColumn = useCallback((api: GridApi, rowNode: IRowNode): Column | null => {
    const columns = api.getAllDisplayedColumns();
    return columns.find((col) => col.isCellEditable(rowNode)) || null;
  }, []);

  const handleCellKeyDown = useCallback(
    (event: CellKeyDownEvent<DatagridData<T>>) => {
      const { event: keyboardEvent, api, node, column } = event;


      // Gestisci solo il tasto Tab (non Shift+Tab)
      if (!keyboardEvent || !("key" in keyboardEvent) || !("shiftKey" in keyboardEvent)) {
        return;
      }
      if (keyboardEvent.key !== "Tab" || keyboardEvent.shiftKey) {
        return;
      }

      const rowIndex = node.rowIndex ?? 0;

      if (isLastEditableCell(api, rowIndex, column)) {
        // L'utente ha premuto Tab sull'ultima cella editabile dell'ultima riga

        // Solo se autoAddRowOnTab è true, aggiungi una nuova riga
        if (autoAddRowOnTab && onAddRow && gotoEditCell && getNewRow) {
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation();

          // Aggiungi una nuova riga
          const newNode = onAddRow();

          if (newNode) {
            // Focus sulla prima cella editabile della nuova riga
            const firstEditableCol = getFirstEditableColumn(api, newNode);
            if (firstEditableCol) {
              setTimeout(() => {
                gotoEditCell(newNode.rowIndex ?? 0, firstEditableCol);
              }, 50);
            }
          }
        }
      }
    },
    [isLastEditableCell, getFirstEditableColumn, onAddRow, gotoEditCell, getNewRow, autoAddRowOnTab]
  );

  return {
    handleCellKeyDown,
  };
}

export default useTabNavigation;
