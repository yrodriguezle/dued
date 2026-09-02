import { Column, GridApi, IRowNode } from "ag-grid-community";
import { datagridAuxiliaryColumns } from "../../../../common/globals/constants";

export interface EditableCellPosition {
  rowIndex: number;
  column: Column;
}

/** Le colonne di servizio (numero riga, stato) non sono destinazioni valide per la navigazione. */
function isNavigable(column: Column, node: IRowNode): boolean {
  if (datagridAuxiliaryColumns.includes(column.getColId())) {
    return false;
  }
  return column.isCellEditable(node);
}

function findEditableColumn(api: GridApi, rowIndex: number, columns: Column[]): Column | null {
  const node = api.getDisplayedRowAtIndex(rowIndex);
  // Le righe pinnate (i totali in fondo) non sono destinazioni di navigazione.
  if (!node || node.rowPinned) {
    return null;
  }
  return columns.find((column) => isNavigable(column, node)) ?? null;
}

/**
 * La prima cella editabile della griglia, scandendo le righe dall'alto.
 * Serve sia a entrare in una griglia arrivando da quella precedente, sia a
 * riprendere l'editing su una riga appena aggiunta.
 */
export function findFirstEditableCell(api: GridApi): EditableCellPosition | null {
  const columns = api.getAllDisplayedColumns();
  const rowIndexes = Array.from({ length: api.getDisplayedRowCount() }, (_, index) => index);

  const rowIndex = rowIndexes.find((index) => findEditableColumn(api, index, columns) !== null);
  if (rowIndex === undefined) {
    return null;
  }

  const column = findEditableColumn(api, rowIndex, columns);
  return column ? { rowIndex, column } : null;
}

/**
 * La cella editabile successiva a quella data: prima il resto della riga, poi le
 * righe seguenti. Le colonne non editabili vengono saltate, perché fermarsi lì
 * chiuderebbe l'editing e romperebbe la digitazione in sequenza.
 *
 * Ritorna null quando non c'è più niente da editare: è l'ultima cella della griglia.
 */
export function findNextEditableCell(api: GridApi, rowIndex: number, colId: string): EditableCellPosition | null {
  const columns = api.getAllDisplayedColumns();
  const currentColIndex = columns.findIndex((column) => column.getColId() === colId);
  if (currentColIndex === -1) {
    return null;
  }

  const currentNode = api.getDisplayedRowAtIndex(rowIndex);
  if (currentNode && !currentNode.rowPinned) {
    const nextInRow = columns.slice(currentColIndex + 1).find((column) => isNavigable(column, currentNode));
    if (nextInRow) {
      return { rowIndex, column: nextInRow };
    }
  }

  const followingRows = Array.from({ length: api.getDisplayedRowCount() }, (_, index) => index).slice(rowIndex + 1);
  const nextRowIndex = followingRows.find((index) => findEditableColumn(api, index, columns) !== null);
  if (nextRowIndex === undefined) {
    return null;
  }

  const column = findEditableColumn(api, nextRowIndex, columns);
  return column ? { rowIndex: nextRowIndex, column } : null;
}

/**
 * Apre in editing la prima cella editabile della griglia. Usata per passare il
 * testimone da una griglia alla successiva quando il Tab esce dall'ultima cella.
 */
export function focusFirstEditableCell(api: GridApi | null | undefined): boolean {
  if (!api) {
    return false;
  }
  const target = findFirstEditableCell(api);
  if (!target) {
    return false;
  }
  api.ensureIndexVisible(target.rowIndex);
  api.ensureColumnVisible(target.column);
  api.setFocusedCell(target.rowIndex, target.column);
  api.startEditingCell({ rowIndex: target.rowIndex, colKey: target.column });
  return true;
}
