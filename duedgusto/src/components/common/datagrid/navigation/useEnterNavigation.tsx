import { useCallback } from "react";
import { CellKeyDownEvent, Column, GridApi, IRowNode, RowPinnedType } from "ag-grid-community";
import { DatagridData } from "../@types/Datagrid";

interface UseEnterNavigationProps<T extends Record<string, unknown>> {
  isMobile: boolean;
  getNewRow?: () => T;
  onAddRow?: (index?: number) => IRowNode<DatagridData<T>> | undefined;
  gotoEditCell?: (rowIndex: number, col: string | Column, rowPinned?: RowPinnedType) => Promise<boolean>;
  autoAddRowOnTab?: boolean;
}

interface UseEnterNavigationReturn {
  handleEnterNavigation: (event: CellKeyDownEvent) => void;
}

function useEnterNavigation<T extends Record<string, unknown>>(props: UseEnterNavigationProps<T>): UseEnterNavigationReturn {
  const { isMobile, getNewRow, onAddRow, gotoEditCell, autoAddRowOnTab = true } = props;

  const getNextEditableColumn = useCallback((api: GridApi, rowIndex: number, currentColumn: Column): Column | null => {
    const allColumns = api.getAllDisplayedColumns();
    const currentColIndex = allColumns.findIndex((col) => col.getColId() === currentColumn.getColId());
    const node = api.getDisplayedRowAtIndex(rowIndex);
    if (!node) return null;

    const remaining = allColumns.slice(currentColIndex + 1);
    return remaining.find((col) => col.isCellEditable(node)) ?? null;
  }, []);

  const getFirstEditableColumn = useCallback((api: GridApi, rowNode: IRowNode): Column | null => {
    const columns = api.getAllDisplayedColumns();
    return columns.find((col) => col.isCellEditable(rowNode)) ?? null;
  }, []);

  const handleEnterNavigation = useCallback(
    (event: CellKeyDownEvent<DatagridData<T>>) => {
      if (!isMobile) return;

      const { event: keyboardEvent, api, node, column } = event;

      if (!keyboardEvent || !("key" in keyboardEvent)) return;
      if (keyboardEvent.key !== "Enter") return;

      const rowIndex = node.rowIndex;
      if (rowIndex === null) return;

      // Previeni il comportamento default di AG Grid (conferma e resta)
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();

      api.stopEditing();

      // 1. Cerca la prossima cella editabile nella stessa riga
      const nextCol = getNextEditableColumn(api, rowIndex, column);
      if (nextCol && gotoEditCell) {
        gotoEditCell(rowIndex, nextCol);
        return;
      }

      // 2. Vai alla prima cella editabile della riga successiva
      const nextRowIndex = rowIndex + 1;
      const totalRows = api.getDisplayedRowCount();

      if (nextRowIndex < totalRows) {
        const targetNode = api.getDisplayedRowAtIndex(nextRowIndex);
        if (targetNode && !targetNode.rowPinned) {
          const firstCol = getFirstEditableColumn(api, targetNode);
          if (firstCol && gotoEditCell) {
            gotoEditCell(nextRowIndex, firstCol);
            return;
          }
        }
      }

      // 3. Ultima riga, ultima cella → aggiungi nuova riga (come Tab)
      if (autoAddRowOnTab && onAddRow && gotoEditCell && getNewRow) {
        const newNode = onAddRow();
        if (newNode) {
          const firstCol = getFirstEditableColumn(api, newNode);
          if (firstCol) {
            setTimeout(() => {
              gotoEditCell(newNode.rowIndex ?? 0, firstCol);
            }, 50);
          }
        }
      }
    },
    [isMobile, getNextEditableColumn, getFirstEditableColumn, onAddRow, gotoEditCell, getNewRow, autoAddRowOnTab]
  );

  return { handleEnterNavigation };
}

export default useEnterNavigation;
