import { useCallback } from "react";
import { CellKeyDownEvent } from "ag-grid-community";
import { DatagridData } from "../@types/Datagrid";

interface UseEnterNavigationProps {
  isMobile: boolean;
  /** Stessa funzione usata dal Tab: su mobile l'Invio deve comportarsi come il Tab. */
  navigateFromCell: (rowIndex: number, colId: string, options: { fromKeyboard: boolean }) => boolean;
}

interface UseEnterNavigationReturn<T extends object> {
  handleEnterNavigation: (event: CellKeyDownEvent<DatagridData<T>>) => void;
}

function useEnterNavigation<T extends object>({ isMobile, navigateFromCell }: UseEnterNavigationProps): UseEnterNavigationReturn<T> {
  const handleEnterNavigation = useCallback(
    (event: CellKeyDownEvent<DatagridData<T>>) => {
      if (!isMobile) return;

      const { event: keyboardEvent, node, column } = event;

      if (!keyboardEvent || !("key" in keyboardEvent)) return;
      if (keyboardEvent.key !== "Enter") return;

      const rowIndex = node.rowIndex;
      if (rowIndex === null) return;

      // AG Grid di suo conferma e resta sulla cella: qui l'Invio deve avanzare.
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();

      navigateFromCell(rowIndex, column.getColId(), { fromKeyboard: false });
    },
    [isMobile, navigateFromCell]
  );

  return { handleEnterNavigation };
}

export default useEnterNavigation;
