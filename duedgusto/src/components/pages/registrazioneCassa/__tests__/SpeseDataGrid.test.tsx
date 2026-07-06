import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

// AG Grid Enterprise non gira in modo affidabile in jsdom: sostituiamo il Datagrid con uno
// stub che cattura le props (columnDefs + callback) così da pilotare direttamente la logica
// di SpeseDataGrid (persistenza per-riga, editabilità colonna Data, cancellazione).
type DatagridColDefLike = {
  field?: string;
  editable?: boolean | ((params: { data?: unknown }) => boolean);
};
type CapturedDatagridProps = {
  columnDefs: DatagridColDefLike[];
  onGridReady?: (event: { api: unknown }) => void;
  onCellValueChanged?: (event: { data: unknown; colDef: { field?: string }; newValue?: unknown; api: unknown }) => void;
  additionalToolbarButtons?: React.ReactNode;
};
let capturedDatagridProps: CapturedDatagridProps | null = null;
vi.mock("../../../common/datagrid/Datagrid", () => ({
  default: (props: CapturedDatagridProps) => {
    capturedDatagridProps = props;
    return <div data-testid="datagrid-stub">{props.additionalToolbarButtons}</div>;
  },
}));

// OverflowToolbar: cattura le azioni della toolbar (per invocare direttamente onClick).
type ToolbarAction = { key: string; onClick: () => void };
let capturedActions: ToolbarAction[] = [];
vi.mock("../../../common/toolbar/OverflowToolbar", () => ({
  default: (props: { actions: ToolbarAction[] }) => {
    capturedActions = props.actions;
    return <div data-testid="overflow-toolbar-stub" />;
  },
}));

vi.mock("../PagamentoFornitoreDialog", () => ({
  default: () => <div data-testid="pagamento-dialog-stub" />,
}));

import SpeseDataGrid, { SpeseDataGridPersistence } from "../SpeseDataGrid";

// Fake AG Grid API: i metodi usati da SpeseDataGrid sono no-op/spy.
function makeFakeApi(selectedRows: unknown[] = []) {
  return {
    addEventListener: vi.fn(),
    forEachNode: vi.fn(),
    applyTransaction: vi.fn(),
    getSelectedRows: vi.fn(() => selectedRows),
    ensureIndexVisible: vi.fn(),
    setFocusedCell: vi.fn(),
    startEditingCell: vi.fn(),
  };
}

function makePersistence(): SpeseDataGridPersistence {
  return {
    createExpense: vi.fn(async () => 123),
    updateExpense: vi.fn(async () => undefined),
    deleteExpense: vi.fn(async () => undefined),
    createSupplierPayment: vi.fn(async () => 456),
    updateSupplierPayment: vi.fn(async () => undefined),
    deleteSupplierPayment: vi.fn(async () => undefined),
  };
}

function renderGrid(props: Partial<React.ComponentProps<typeof SpeseDataGrid>> = {}) {
  return render(
    <SpeseDataGrid
      initialExpenses={[]}
      isLocked={false}
      date="2026-05-01"
      columns={{ showData: true, showCategoria: true }}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedDatagridProps = null;
  capturedActions = [];
});

describe("SpeseDataGrid — colonna Data editabile per pagamenti origine-chiusura (Fix A)", () => {
  it("la colonna Data è editabile su spese e pagamenti origine-chiusura, read-only sui pagamenti origine-cassa", () => {
    renderGrid({ persistence: makePersistence() });

    const dataCol = capturedDatagridProps!.columnDefs.find((c) => c.field === "data");
    expect(dataCol).toBeDefined();
    const editable = dataCol!.editable as (params: { data?: unknown }) => boolean;

    // Spesa libera → editabile
    expect(editable({ data: { isPagamentoFornitore: false } })).toBe(true);
    // Pagamento origine-chiusura (registroCassaId == null) → editabile
    expect(editable({ data: { isPagamentoFornitore: true, registroCassaId: null } })).toBe(true);
    // Pagamento origine-cassa (registroCassaId valorizzato) → read-only
    expect(editable({ data: { isPagamentoFornitore: true, registroCassaId: 99 } })).toBe(false);
  });

  it("modificando la Data di un pagamento origine-chiusura chiama updateSupplierPayment", async () => {
    const persistence = makePersistence();
    renderGrid({ persistence });
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const paymentRow = { pagamentoId: 50, isPagamentoFornitore: true, registroCassaId: null, amount: 100, data: "2026-05-10", description: "Pagamento" };
    await act(async () => {
      capturedDatagridProps!.onCellValueChanged!({ data: paymentRow, colDef: { field: "data" }, newValue: "2026-05-10", api });
    });

    expect(persistence.updateSupplierPayment).toHaveBeenCalledWith(paymentRow);
    expect(persistence.updateExpense).not.toHaveBeenCalled();
  });

  it("non persiste modifiche sui pagamenti origine-cassa (read-only)", async () => {
    const persistence = makePersistence();
    renderGrid({ persistence });
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const cassaPayment = { pagamentoId: 60, isPagamentoFornitore: true, registroCassaId: 99, amount: 100, data: "2026-05-10" };
    await act(async () => {
      capturedDatagridProps!.onCellValueChanged!({ data: cassaPayment, colDef: { field: "data" }, newValue: "2026-05-11", api });
    });

    expect(persistence.updateSupplierPayment).not.toHaveBeenCalled();
  });
});

describe("SpeseDataGrid — colonna Categoria (registro cassa)", () => {
  it("con showCategoria mostra la colonna Categoria con l'editor a tendina e i valori di default", () => {
    renderGrid();

    const categoriaCol = capturedDatagridProps!.columnDefs.find((c) => c.field === "categoria");
    expect(categoriaCol).toBeDefined();
    expect((categoriaCol as { cellEditor?: string }).cellEditor).toBe("agSelectCellEditor");
    expect((categoriaCol as { cellEditorParams?: { values?: unknown[] } }).cellEditorParams?.values).toEqual([
      "Affitto",
      "Utenze",
      "Stipendi",
      "Altro",
    ]);
  });

  it("la Categoria è editabile sulle spese normali ma non sui pagamenti fornitore", () => {
    renderGrid();

    const categoriaCol = capturedDatagridProps!.columnDefs.find((c) => c.field === "categoria");
    const editable = categoriaCol!.editable as (params: { data?: unknown }) => boolean;
    // Spesa normale del registro → categoria modificabile
    expect(editable({ data: { isPagamentoFornitore: false } })).toBe(true);
    // Pagamento fornitore → categoria read-only in griglia (si modifica dal dialog)
    expect(editable({ data: { isPagamentoFornitore: true } })).toBe(false);
  });

  it("senza showCategoria la colonna Categoria non viene renderizzata", () => {
    renderGrid({ columns: { showData: true } });
    expect(capturedDatagridProps!.columnDefs.find((c) => c.field === "categoria")).toBeUndefined();
  });

  it("modificando la Categoria di una spesa (staged) l'importo/valore resta locale senza errori", async () => {
    // Registro cassa = modalità staged (nessuna persistence): il cambio di Categoria
    // aggiorna la riga senza toccare il server.
    renderGrid();
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const row = { description: "Bolletta", amount: 80, categoria: "Altro", isPagamentoFornitore: false };
    await act(async () => {
      capturedDatagridProps!.onCellValueChanged!({ data: { ...row, categoria: "Utenze" }, colDef: { field: "categoria" }, newValue: "Utenze", api });
    });
    // Nessuna scrittura server: staged.
    expect(api.applyTransaction).not.toHaveBeenCalled();
  });
});

describe("SpeseDataGrid — persistenza per-riga (CON persistence)", () => {
  it("crea una spesa libera nuova (spesaId temporaneo) → createExpense", async () => {
    const persistence = makePersistence();
    renderGrid({ persistence });
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const newRow = { description: "Affitto", amount: 500, spesaId: -1, data: "2026-05-03", categoria: "Altro", isPagamentoFornitore: false };
    await act(async () => {
      capturedDatagridProps!.onCellValueChanged!({ data: newRow, colDef: { field: "amount" }, newValue: 500, api });
    });

    expect(persistence.createExpense).toHaveBeenCalledTimes(1);
    expect(persistence.updateExpense).not.toHaveBeenCalled();
  });

  it("aggiorna una spesa libera esistente (spesaId > 0) → updateExpense", async () => {
    const persistence = makePersistence();
    renderGrid({ persistence });
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const existingRow = { description: "Affitto", amount: 600, spesaId: 5, categoria: "Altro", isPagamentoFornitore: false };
    await act(async () => {
      capturedDatagridProps!.onCellValueChanged!({ data: existingRow, colDef: { field: "amount" }, newValue: 600, api });
    });

    expect(persistence.updateExpense).toHaveBeenCalledTimes(1);
    expect(persistence.createExpense).not.toHaveBeenCalled();
  });

  it("cancella una spesa libera salvata → deleteExpense", async () => {
    const persistence = makePersistence();
    const selected = [{ spesaId: 7, isPagamentoFornitore: false }];
    renderGrid({ persistence });
    const api = makeFakeApi(selected);
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const deleteAction = capturedActions.find((a) => a.key === "delete");
    expect(deleteAction).toBeDefined();
    await act(async () => deleteAction!.onClick());

    expect(persistence.deleteExpense).toHaveBeenCalledTimes(1);
    expect(api.applyTransaction).toHaveBeenCalled(); // rimozione locale della riga
  });

  it("cancella un pagamento origine-chiusura → deleteSupplierPayment; ignora i pagamenti origine-cassa", async () => {
    const persistence = makePersistence();
    const selected = [
      { pagamentoId: 10, isPagamentoFornitore: true, registroCassaId: null },
      { pagamentoId: 11, isPagamentoFornitore: true, registroCassaId: 99 }, // origine-cassa: ignorato
    ];
    renderGrid({ persistence });
    const api = makeFakeApi(selected);
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const deleteAction = capturedActions.find((a) => a.key === "delete");
    await act(async () => deleteAction!.onClick());

    expect(persistence.deleteSupplierPayment).toHaveBeenCalledTimes(1);
    expect(persistence.deleteSupplierPayment).toHaveBeenCalledWith(selected[0]);
  });
});

describe("SpeseDataGrid — modalità staged (SENZA persistence, non-regressione cassa)", () => {
  it("una modifica di cella NON invoca alcun callback di persistenza", async () => {
    renderGrid({ persistence: undefined });
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    // Senza persistenza il change è solo locale: nessuna eccezione, nessuna scrittura server.
    await act(async () => {
      capturedDatagridProps!.onCellValueChanged!({
        data: { description: "Spesa scontrino", amount: 15, isPagamentoFornitore: false },
        colDef: { field: "amount" },
        newValue: 15,
        api,
      });
    });
    // Nulla da persistere: reportExpenses gira ma non tocca il server (nessun callback disponibile).
    expect(api.applyTransaction).not.toHaveBeenCalled();
  });

  it("la cancellazione rimuove le righe SOLO localmente (applyTransaction remove), senza server", async () => {
    const selected = [{ spesaId: 3, isPagamentoFornitore: false }];
    renderGrid({ persistence: undefined });
    const api = makeFakeApi(selected);
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const deleteAction = capturedActions.find((a) => a.key === "delete");
    await act(async () => deleteAction!.onClick());

    expect(api.applyTransaction).toHaveBeenCalledWith({ remove: selected });
  });
});
