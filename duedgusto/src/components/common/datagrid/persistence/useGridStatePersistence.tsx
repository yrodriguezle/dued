import { useCallback, useEffect, useRef } from "react";
import { ColumnResizedEvent, GridApi } from "ag-grid-community";

import debounce from "../../../../common/bones/debounce";
import { getGridColumnState, setGridColumnState, removeGridColumnState } from "../../../../common/ui/gridStateStorage";

interface UseGridStatePersistenceParams {
  gridId: string | undefined;
  api: GridApi | null;
}

const DEBOUNCE_MS = 500;

function useGridStatePersistence({ gridId, api }: UseGridStatePersistenceParams) {
  const debouncedSaveRef = useRef<ReturnType<typeof debounce> | null>(null);

  const saveState = useCallback(() => {
    if (!gridId || !api) return;
    const state = api.getColumnState();
    setGridColumnState(gridId, state);
  }, [gridId, api]);

  const restoreState = useCallback(() => {
    if (!gridId || !api) return;
    const savedState = getGridColumnState(gridId);
    if (savedState) {
      api.applyColumnState({ state: savedState, applyOrder: true });
    }
  }, [gridId, api]);

  const resetState = useCallback(() => {
    if (!gridId || !api) return;
    removeGridColumnState(gridId);
    api.resetColumnState();
  }, [gridId, api]);

  // Registra event listener per salvare lo stato colonne con debounce
  useEffect(() => {
    if (!gridId || !api) return;

    const debouncedSave = debounce(() => {
      const state = api.getColumnState();
      setGridColumnState(gridId, state);
    }, DEBOUNCE_MS);
    debouncedSaveRef.current = debouncedSave;

    const handleColumnResized = (event: ColumnResizedEvent) => {
      if (event.finished) {
        debouncedSave();
      }
    };

    const handleStateChanged = () => {
      debouncedSave();
    };

    api.addEventListener("columnResized", handleColumnResized);
    api.addEventListener("columnMoved", handleStateChanged);
    api.addEventListener("sortChanged", handleStateChanged);
    api.addEventListener("columnVisible", handleStateChanged);
    api.addEventListener("columnPinned", handleStateChanged);

    return () => {
      debouncedSave.cancel();
      api.removeEventListener("columnResized", handleColumnResized);
      api.removeEventListener("columnMoved", handleStateChanged);
      api.removeEventListener("sortChanged", handleStateChanged);
      api.removeEventListener("columnVisible", handleStateChanged);
      api.removeEventListener("columnPinned", handleStateChanged);
    };
  }, [gridId, api]);

  return { restoreState, saveState, resetState };
}

export default useGridStatePersistence;
