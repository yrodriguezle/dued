import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

// AG Grid Enterprise non gira in modo affidabile in jsdom: sostituiamo il Datagrid con uno
// stub che cattura le props (columnDefs + callback) così da pilotare direttamente la logica
// di SpeseDataGrid (persistenza per-riga, editabilità colonna Data, cancellazione).
type DatagridColDefLike = {
  field?: string;
  editable?: boolean | ((params: { data?: unknown }) => boolean);
  valueGetter?: (params: { data?: unknown }) => unknown;
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

// Mock del modulo theme: useStore → themeStore usa window.matchMedia (assente in jsdom)
vi.mock("../../../theme/theme", () => ({
  getDefaultTheme: vi.fn(() => "light"),
  getLastUserThemeMode: vi.fn(() => "default"),
  setLastUserThemeMode: vi.fn(),
}));

import SpeseDataGrid, { SpeseDataGridPersistence } from "../SpeseDataGrid";
import useStore from "../../../../store/useStore";

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

describe("SpeseDataGrid — modificabilità dei pagamenti decisa dal chiamante", () => {
  it("senza isPaymentReadOnly nessun pagamento è bloccato, qualunque sia registroCassaId", () => {
    renderGrid({ persistence: makePersistence() });

    const dataCol = capturedDatagridProps!.columnDefs.find((c) => c.field === "data");
    expect(dataCol).toBeDefined();
    const editable = dataCol!.editable as (params: { data?: unknown }) => boolean;

    expect(editable({ data: { isPagamentoFornitore: false } })).toBe(true);
    expect(editable({ data: { isPagamentoFornitore: true, registroCassaId: null } })).toBe(true);
    // Dopo il passaggio delle spese sul registro giornaliero registroCassaId è sempre
    // valorizzato: non può più essere lui a decidere la modificabilità.
    expect(editable({ data: { isPagamentoFornitore: true, registroCassaId: 99 } })).toBe(true);
  });

  it("con isPaymentReadOnly blocca solo le righe indicate dal chiamante", () => {
    renderGrid({
      persistence: makePersistence(),
      isPaymentReadOnly: (row: { fatturaId?: number; ddtId?: number }) =>
        row.fatturaId != null || row.ddtId != null,
    });

    const dataCol = capturedDatagridProps!.columnDefs.find((c) => c.field === "data");
    const editable = dataCol!.editable as (params: { data?: unknown }) => boolean;

    // Spesa fissa tracciata: nessun documento → modificabile.
    expect(editable({ data: { isPagamentoFornitore: true, registroCassaId: 99 } })).toBe(true);
    // Pagamento documentale: si gestisce dalla fattura, non da qui.
    expect(editable({ data: { isPagamentoFornitore: true, registroCassaId: 99, fatturaId: 7 } })).toBe(false);
    expect(editable({ data: { isPagamentoFornitore: true, registroCassaId: 99, ddtId: 3 } })).toBe(false);
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

  it("non persiste modifiche sulle righe marcate read-only dal chiamante", async () => {
    const persistence = makePersistence();
    renderGrid({
      persistence,
      isPaymentReadOnly: (row: { fatturaId?: number }) => row.fatturaId != null,
    });
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const documentale = { pagamentoId: 60, isPagamentoFornitore: true, fatturaId: 7, amount: 100, data: "2026-05-10" };
    await act(async () => {
      capturedDatagridProps!.onCellValueChanged!({ data: documentale, colDef: { field: "data" }, newValue: "2026-05-11", api });
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

  it("cancella i pagamenti modificabili → deleteSupplierPayment; ignora quelli read-only", async () => {
    const persistence = makePersistence();
    const selected = [
      { pagamentoId: 10, isPagamentoFornitore: true },
      { pagamentoId: 11, isPagamentoFornitore: true, fatturaId: 7 }, // documentale: ignorato
    ];
    renderGrid({
      persistence,
      isPaymentReadOnly: (row: { fatturaId?: number }) => row.fatturaId != null,
    });
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

describe("SpeseDataGrid — modalità chiusura mensile (colonna metodo di pagamento)", () => {
  const columnsChiusura = {
    showData: true,
    showCategoria: true,
    showMetodoPagamento: true,
    showPagamentoFornitore: false,
    defaultCategoria: "Utenze" as CategoriaSpesa,
  };

  it("mostra la colonna Pagamento con Contanti come default di riga", () => {
    renderGrid({ persistence: makePersistence(), columns: columnsChiusura });

    const metodoCol = capturedDatagridProps!.columnDefs.find((c) => c.field === "paymentMethod");
    expect(metodoCol).toBeDefined();
    const valueGetter = metodoCol!.valueGetter as (p: { data?: unknown }) => string;
    expect(valueGetter({ data: {} })).toBe("Contanti");
    expect(valueGetter({ data: { paymentMethod: "Bonifico" } })).toBe("Bonifico");
  });

  it("non espone l'azione Pagamento fornitore: il dialog pretende fornitore e documento", () => {
    renderGrid({ persistence: makePersistence(), columns: columnsChiusura });

    expect(capturedActions.find((a) => a.key === "fornitore")).toBeUndefined();
  });

  it("in cassa l'azione Pagamento fornitore resta disponibile (non-regressione)", () => {
    renderGrid({ persistence: undefined, columns: { showData: true, showCategoria: true } });

    expect(capturedActions.find((a) => a.key === "fornitore")).toBeDefined();
  });

  it("instrada anche le righe tracciate su updateExpense: è il chiamante a convertirle", async () => {
    const persistence = makePersistence();
    renderGrid({ persistence, columns: columnsChiusura });
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const riga = { pagamentoId: 50, isPagamentoFornitore: true, amount: 3000, paymentMethod: "Bonifico", description: "Stipendi" };
    await act(async () => {
      capturedDatagridProps!.onCellValueChanged!({ data: riga, colDef: { field: "amount" }, newValue: 3000, api });
    });

    expect(persistence.updateExpense).toHaveBeenCalledWith(riga);
    expect(persistence.updateSupplierPayment).not.toHaveBeenCalled();
  });
});

describe("SpeseDataGrid — importo del giornale dalle impostazioni", () => {
  // Il pulsante "Giornale" e attivo solo in cassa (senza persistence).
  const columnsCassa = { showData: true, showCategoria: true };

  function aggiungiGiornale(date: string) {
    renderGrid({ date, columns: columnsCassa });
    const api = makeFakeApi();
    act(() => capturedDatagridProps!.onGridReady!({ api }));

    const giornaleAction = capturedActions.find((a) => a.key === "giornale");
    expect(giornaleAction).toBeDefined();
    act(() => giornaleAction!.onClick());

    const [transaction] = api.applyTransaction.mock.calls[0] as [{ add: { amount: number }[] }];
    return transaction.add[0];
  }

  beforeEach(() => {
    useStore.setState({ settings: null });
  });

  it("usa l'importo del sabato configurato quando la data e un sabato", () => {
    useStore.getState().setSettings({ giornaleImportoSabato: 7.5, giornaleImportoFeriale: 4.1 } as BusinessSettings);

    // 2026-05-02 e un sabato
    const riga = aggiungiGiornale("2026-05-02");

    expect(riga.amount).toBe(7.5);
  });

  it("usa l'importo feriale configurato negli altri giorni", () => {
    useStore.getState().setSettings({ giornaleImportoSabato: 7.5, giornaleImportoFeriale: 4.1 } as BusinessSettings);

    // 2026-05-04 e un lunedi
    const riga = aggiungiGiornale("2026-05-04");

    expect(riga.amount).toBe(4.1);
  });

  it("accetta lo zero come importo configurato senza ricadere sul fallback", () => {
    useStore.getState().setSettings({ giornaleImportoSabato: 0, giornaleImportoFeriale: 0 } as BusinessSettings);

    expect(aggiungiGiornale("2026-05-02").amount).toBe(0);
    expect(aggiungiGiornale("2026-05-04").amount).toBe(0);
  });

  it("ricade sui valori storici finche le impostazioni non sono caricate", () => {
    expect(aggiungiGiornale("2026-05-02").amount).toBe(5);
    expect(aggiungiGiornale("2026-05-04").amount).toBe(3.2);
  });
});

describe("SpeseDataGrid — colonna Note", () => {
  it("con showNote mostra la colonna Note accanto alla Causale", () => {
    renderGrid({ columns: { showData: true, showCategoria: true, showNote: true } });

    const fields = capturedDatagridProps!.columnDefs.map((c) => c.field);
    expect(fields).toContain("note");
    expect(fields.indexOf("note")).toBe(fields.indexOf("description") + 1);
  });

  it("senza showNote la colonna Note non viene renderizzata", () => {
    renderGrid({ columns: { showData: true, showCategoria: true } });

    expect(capturedDatagridProps!.columnDefs.map((c) => c.field)).not.toContain("note");
  });

  it("la Note e editabile sulle spese ma non sui pagamenti origine-cassa", () => {
    renderGrid({
      columns: { showData: true, showCategoria: true, showNote: true, showMetodoPagamento: true },
      isPaymentReadOnly: (row) => row.fatturaId != null,
    });

    const noteCol = capturedDatagridProps!.columnDefs.find((c) => c.field === "note")!;
    const editable = noteCol.editable as (params: { data?: unknown }) => boolean;

    expect(editable({ data: { spesaId: 1 } })).toBe(true);
    // Serve isPagamentoFornitore: isReadOnlyPayment blocca solo le righe di pagamento.
    expect(editable({ data: { pagamentoId: 5, isPagamentoFornitore: true, fatturaId: 9 } })).toBe(false);
    // Pagamento senza documento (spesa fissa tracciata): resta annotabile.
    expect(editable({ data: { pagamentoId: 6, isPagamentoFornitore: true, fatturaId: null } })).toBe(true);
  });
});
