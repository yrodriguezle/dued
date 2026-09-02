import { describe, it, expect, vi } from "vitest";
import { Column, GridApi, IRowNode } from "ag-grid-community";
import { findFirstEditableCell, findNextEditableCell, focusFirstEditableCell } from "../editableCells";

interface FakeColumnSpec {
  colId: string;
  /** Righe (per indice) in cui la cella è editabile. `true` = sempre. */
  editableOn?: true | number[];
}

interface FakeGridSpec {
  columns: FakeColumnSpec[];
  rowCount: number;
  /** Indici di riga pinnata (i totali in fondo). */
  pinnedRows?: number[];
}

function createGrid({ columns, rowCount, pinnedRows = [] }: FakeGridSpec) {
  const nodes: IRowNode[] = Array.from({ length: rowCount }, (_, rowIndex) => ({
    rowIndex,
    rowPinned: pinnedRows.includes(rowIndex) ? "bottom" : null,
  })) as unknown as IRowNode[];

  const fakeColumns = columns.map((spec) => {
    const column = {
      getColId: () => spec.colId,
      isCellEditable: (node: IRowNode) => {
        if (spec.editableOn === undefined) return false;
        if (spec.editableOn === true) return true;
        return spec.editableOn.includes(node.rowIndex ?? -1);
      },
    };
    return column as unknown as Column;
  });

  const api = {
    getAllDisplayedColumns: () => fakeColumns,
    getDisplayedRowCount: () => rowCount,
    getDisplayedRowAtIndex: (index: number) => nodes[index] ?? null,
    ensureIndexVisible: vi.fn(),
    ensureColumnVisible: vi.fn(),
    setFocusedCell: vi.fn(),
    startEditingCell: vi.fn(),
  };

  return { api: api as unknown as GridApi, fakeColumns };
}

describe("findNextEditableCell", () => {
  it("salta le colonne non editabili nella stessa riga", () => {
    const { api } = createGrid({
      columns: [{ colId: "data", editableOn: true }, { colId: "tipo" }, { colId: "importo", editableOn: true }],
      rowCount: 3,
    });

    const next = findNextEditableCell(api, 0, "data");

    expect(next).not.toBeNull();
    expect(next?.rowIndex).toBe(0);
    expect(next?.column.getColId()).toBe("importo");
  });

  it("passa alla riga successiva quando la riga corrente è finita", () => {
    // Come INCASSI e CONTEGGIO CASSA: una sola colonna editabile per riga.
    const { api } = createGrid({
      columns: [{ colId: "taglio" }, { colId: "quantita", editableOn: true }, { colId: "totale" }],
      rowCount: 3,
    });

    const next = findNextEditableCell(api, 0, "quantita");

    expect(next?.rowIndex).toBe(1);
    expect(next?.column.getColId()).toBe("quantita");
  });

  it("ignora le righe pinnate dei totali", () => {
    const { api } = createGrid({
      columns: [{ colId: "quantita", editableOn: true }],
      rowCount: 3,
      pinnedRows: [2],
    });

    expect(findNextEditableCell(api, 1, "quantita")).toBeNull();
  });

  it("ritorna null sull'ultima cella editabile della griglia", () => {
    const { api } = createGrid({
      columns: [{ colId: "taglio" }, { colId: "quantita", editableOn: true }, { colId: "totale" }],
      rowCount: 2,
    });

    expect(findNextEditableCell(api, 1, "quantita")).toBeNull();
  });

  it("salta le righe in cui nessuna colonna è editabile", () => {
    const { api } = createGrid({
      columns: [{ colId: "importo", editableOn: [0, 3] }],
      rowCount: 4,
    });

    expect(findNextEditableCell(api, 0, "importo")?.rowIndex).toBe(3);
  });

  it("ritorna null se la colonna di partenza non esiste più", () => {
    const { api } = createGrid({ columns: [{ colId: "importo", editableOn: true }], rowCount: 2 });

    expect(findNextEditableCell(api, 0, "colonna-sparita")).toBeNull();
  });

  it("non propone la colonna di servizio status", () => {
    const { api } = createGrid({
      columns: [{ colId: "importo", editableOn: true }, { colId: "status", editableOn: true }],
      rowCount: 1,
    });

    expect(findNextEditableCell(api, 0, "importo")).toBeNull();
  });
});

describe("findFirstEditableCell", () => {
  it("trova la prima cella editabile scandendo dall'alto", () => {
    const { api } = createGrid({
      columns: [{ colId: "taglio" }, { colId: "quantita", editableOn: [1, 2] }],
      rowCount: 3,
    });

    const first = findFirstEditableCell(api);

    expect(first?.rowIndex).toBe(1);
    expect(first?.column.getColId()).toBe("quantita");
  });

  it("ritorna null quando non c'è niente di editabile", () => {
    const { api } = createGrid({ columns: [{ colId: "taglio" }], rowCount: 3 });

    expect(findFirstEditableCell(api)).toBeNull();
  });
});

describe("focusFirstEditableCell", () => {
  it("apre in editing la prima cella editabile", () => {
    const { api, fakeColumns } = createGrid({
      columns: [{ colId: "taglio" }, { colId: "quantita", editableOn: true }],
      rowCount: 2,
    });

    expect(focusFirstEditableCell(api)).toBe(true);
    expect(api.setFocusedCell).toHaveBeenCalledWith(0, fakeColumns[1]);
    expect(api.startEditingCell).toHaveBeenCalledWith({ rowIndex: 0, colKey: fakeColumns[1] });
  });

  it("non fa niente senza api o senza celle editabili", () => {
    const { api } = createGrid({ columns: [{ colId: "taglio" }], rowCount: 2 });

    expect(focusFirstEditableCell(null)).toBe(false);
    expect(focusFirstEditableCell(api)).toBe(false);
    expect(api.startEditingCell).not.toHaveBeenCalled();
  });
});
