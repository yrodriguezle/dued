import { useCallback } from "react";
import { CellKeyDownEvent } from "ag-grid-community";
import { DatagridData } from "../@types/Datagrid";

interface UseTabNavigationProps {
  /**
   * Sposta l'editing a partire dalla cella data. Ritorna true se ha preso in
   * carico lo spostamento: in quel caso il Tab nativo va annullato, altrimenti
   * AG Grid muoverebbe il focus una seconda volta.
   */
  navigateFromCell: (rowIndex: number, colId: string, options: { fromKeyboard: boolean }) => boolean;
}

interface UseTabNavigationReturn<T extends object> {
  handleCellKeyDown: (event: CellKeyDownEvent<DatagridData<T>>) => void;
}

function useTabNavigation<T extends object>({ navigateFromCell }: UseTabNavigationProps): UseTabNavigationReturn<T> {
  const handleCellKeyDown = useCallback(
    (event: CellKeyDownEvent<DatagridData<T>>) => {
      const { event: keyboardEvent, node, column } = event;

      if (!keyboardEvent || !("key" in keyboardEvent) || !("shiftKey" in keyboardEvent)) {
        return;
      }
      if (keyboardEvent.key !== "Tab" || keyboardEvent.shiftKey) {
        return;
      }

      const rowIndex = node.rowIndex ?? 0;
      const handled = navigateFromCell(rowIndex, column.getColId(), { fromKeyboard: true });

      if (handled) {
        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
      }
    },
    [navigateFromCell]
  );

  return { handleCellKeyDown };
}

export default useTabNavigation;
