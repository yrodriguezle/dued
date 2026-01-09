import { useCallback, useRef } from "react";
import { CellEditingStartedEvent, CellEditingStoppedEvent, IRowNode } from "ag-grid-community";
import { DatagridData } from "../@types/Datagrid";
import { DatagridStatus } from "../../../../common/globals/constants";

interface UseEditingStateReturn {
  handleCellEditingStarted: (event: CellEditingStartedEvent) => void;
  handleCellEditingStopped: (event: CellEditingStoppedEvent) => void;
  currentEditingRow: React.MutableRefObject<IRowNode | null>;
}

function useEditingState<T extends Record<string, unknown>>(
  onEditingStatusChange?: (isEditing: boolean) => void
): UseEditingStateReturn {
  const currentEditingRow = useRef<IRowNode<DatagridData<T>> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCellEditingStarted = useCallback(
    (event: CellEditingStartedEvent<DatagridData<T>>) => {
      const { node, data, api } = event;

      // Cancella qualsiasi timeout pendente - stiamo iniziando un nuovo editing
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }

      // Controlla se stiamo passando a una riga diversa
      const isNewRow = !currentEditingRow.current || currentEditingRow.current.id !== node.id;

      // Se si sta editando una riga diversa, rimuovere lo stato editing dalla riga precedente
      if (isNewRow && currentEditingRow.current) {
        // Salva il riferimento al nodo precedente prima di cambiarlo
        const prevNode = currentEditingRow.current;
        const prevData = prevNode.data;
        if (prevData) {
          // Rimuovi sempre lo stato Editing dalla riga precedente quando si passa a una nuova riga
          if (prevData.status === DatagridStatus.Editing) {
            prevData.status = DatagridStatus.Modified;
          }
          // Aggiorna la visualizzazione della riga precedente
          api.refreshCells({ rowNodes: [prevNode], force: true });
        }
      }

      // Imposta la riga corrente come in editing
      currentEditingRow.current = node;
      if (data && data.status !== DatagridStatus.Invalid) {
        data.status = DatagridStatus.Editing;
        api.refreshCells({ rowNodes: [node], force: true });
      }

      // Deseleziona tutte le righe (comportamento esistente)
      api.deselectAll();

      // Notifica al parent che l'editing è iniziato solo se è una nuova riga
      if (isNewRow) {
        onEditingStatusChange?.(true);
      }
    },
    [onEditingStatusChange]
  );

  const handleCellEditingStopped = useCallback(
    (event: CellEditingStoppedEvent<DatagridData<T>>) => {
      const { node, api } = event;

      // Usa un timeout per dare tempo ad AG Grid di iniziare l'editing della prossima cella
      // Se l'editing ricomincia sulla stessa riga, handleCellEditingStarted cancellerà questo timeout
      stopTimeoutRef.current = setTimeout(() => {
        // Controlla se il focus si è spostato su un'altra cella della stessa riga
        const focusedCell = api.getFocusedCell();
        const isStillInSameRow = focusedCell?.rowIndex === node.rowIndex && focusedCell?.rowPinned === node.rowPinned;

        // Controlla anche se c'è una cella in editing attivo
        const editingCells = api.getEditingCells();
        const isStillEditing = editingCells.length > 0 && editingCells[0].rowIndex === node.rowIndex;

        if (!isStillInSameRow && !isStillEditing) {
          // L'utente ha lasciato la riga - rimuovi lo stato editing
          if (node.data?.status === DatagridStatus.Editing) {
            const { data } = node;
            if (data) {
              data.status = DatagridStatus.Modified;
            }
            api.refreshCells({ rowNodes: [node], force: true });
          }
          currentEditingRow.current = null;

          // Riabilita il pulsante aggiungi
          onEditingStatusChange?.(false);
        }
        // Se si è ancora nella stessa riga o c'è editing attivo, mantieni lo stato editing e l'icona visibile
        stopTimeoutRef.current = null;
      }, 0);
    },
    [onEditingStatusChange]
  );

  return {
    handleCellEditingStarted,
    handleCellEditingStopped,
    currentEditingRow,
  };
}

export default useEditingState;
