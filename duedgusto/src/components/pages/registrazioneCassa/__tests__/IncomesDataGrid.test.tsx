import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// AG Grid Enterprise non gira in modo affidabile in jsdom: il Datagrid è sostituito da uno
// stub, così il test pilota direttamente la logica di IncomesDataGrid (riporto degli incassi).
type CapturedDatagridProps = {
  onGridReady?: (event: { api: unknown }) => void;
  onCellValueChanged?: (event: { data: unknown; newValue?: unknown; api: unknown }) => void;
};
let capturedDatagridProps: CapturedDatagridProps | null = null;
vi.mock("../../../common/datagrid/Datagrid", () => ({
  default: (props: CapturedDatagridProps) => {
    capturedDatagridProps = props;
    return <div data-testid="datagrid-stub" />;
  },
}));

import IncomesDataGrid from "../IncomesDataGrid";

const giorno = (contanti: number, elettronico: number, fattura: number): Income[] => [
  { type: "Pago in contanti", amount: contanti },
  { type: "Pagamenti Elettronici", amount: elettronico },
  { type: "Pagamento con Fattura", amount: fattura },
];

beforeEach(() => {
  vi.clearAllMocks();
  capturedDatagridProps = null;
});

describe("IncomesDataGrid — incassi riportati al riepilogo", () => {
  it("cambiando giorno riporta i nuovi incassi senza attendere un nuovo onGridReady", () => {
    const onIncomesChange = vi.fn();
    const { rerender } = render(
      <IncomesDataGrid
        initialIncomes={giorno(500, 300, 0)}
        isLocked={false}
        onIncomesChange={onIncomesChange}
      />
    );

    expect(onIncomesChange).toHaveBeenLastCalledWith([
      { tipo: "Pago in contanti", importo: 500 },
      { tipo: "Pagamenti Elettronici", importo: 300 },
      { tipo: "Pagamento con Fattura", importo: 0 },
    ]);

    // Tornando su un giorno già visitato Apollo risponde dalla cache: il parent non
    // passa dallo stato di caricamento e la griglia non si rimonta.
    onIncomesChange.mockClear();
    rerender(
      <IncomesDataGrid
        initialIncomes={giorno(120, 40, 10)}
        isLocked={false}
        onIncomesChange={onIncomesChange}
      />
    );

    expect(onIncomesChange).toHaveBeenLastCalledWith([
      { tipo: "Pago in contanti", importo: 120 },
      { tipo: "Pagamenti Elettronici", importo: 40 },
      { tipo: "Pagamento con Fattura", importo: 10 },
    ]);
  });

  it("su un giorno senza registro azzera gli incassi invece di lasciare quelli precedenti", () => {
    const onIncomesChange = vi.fn();
    const { rerender } = render(
      <IncomesDataGrid
        initialIncomes={giorno(500, 300, 0)}
        isLocked={false}
        onIncomesChange={onIncomesChange}
      />
    );
    onIncomesChange.mockClear();

    rerender(
      <IncomesDataGrid
        initialIncomes={giorno(0, 0, 0)}
        isLocked={false}
        onIncomesChange={onIncomesChange}
      />
    );

    expect(onIncomesChange).toHaveBeenLastCalledWith([
      { tipo: "Pago in contanti", importo: 0 },
      { tipo: "Pagamenti Elettronici", importo: 0 },
      { tipo: "Pagamento con Fattura", importo: 0 },
    ]);
  });

  it("la modifica di una cella continua a riportare gli incassi letti dalla griglia", () => {
    const onIncomesChange = vi.fn();
    render(
      <IncomesDataGrid
        initialIncomes={giorno(500, 300, 0)}
        isLocked={false}
        onIncomesChange={onIncomesChange}
      />
    );
    onIncomesChange.mockClear();

    const righe: Income[] = giorno(650, 300, 0);
    const api = {
      forEachNode: (cb: (node: { data: Income }) => void) => righe.forEach((data) => cb({ data })),
    };
    capturedDatagridProps!.onCellValueChanged!({ data: righe[0], newValue: 650, api });

    expect(onIncomesChange).toHaveBeenLastCalledWith([
      { tipo: "Pago in contanti", importo: 650 },
      { tipo: "Pagamenti Elettronici", importo: 300 },
      { tipo: "Pagamento con Fattura", importo: 0 },
    ]);
  });
});
