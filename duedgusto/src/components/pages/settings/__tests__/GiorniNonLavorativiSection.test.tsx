import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";

// AG Grid Enterprise non gira in modo affidabile in jsdom: il Datagrid viene sostituito
// da uno stub che cattura le props, così da pilotare direttamente la logica della sezione
// (filtri, aggregazione passata alla griglia, selezione multipla, eliminazione bulk).
type CapturedDatagridProps = {
  items: Array<Record<string, unknown>>;
  treeData?: boolean;
  treeDataParentIdField?: string;
  groupDefaultExpanded?: number;
  getRowId?: (params: { data: Record<string, unknown> }) => string;
  rowSelection?: { mode?: string; groupSelects?: string };
  onGridReady?: (event: { api: unknown }) => void;
};
let capturedDatagridProps: CapturedDatagridProps | null = null;
vi.mock("../../../common/datagrid/Datagrid", () => ({
  default: (props: CapturedDatagridProps) => {
    capturedDatagridProps = props;
    return <div data-testid="datagrid-stub" />;
  },
}));

// Il dialog monta AppDialog (drag, store utente): fuori dallo scopo di questi test.
vi.mock("../GiorniNonLavorativiDialog", () => ({
  default: () => <div data-testid="dialog-stub" />,
}));

const confirmMock = vi.fn(async () => true);
vi.mock("../../../common/confirm/useConfirm", () => ({
  default: () => confirmMock,
}));

const eliminaGiorniMock = vi.fn(async () => undefined);
vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: (documento: unknown) => {
      const nome = (documento as { definitions?: Array<{ name?: { value?: string } }> })?.definitions?.[0]?.name?.value;
      if (nome === "EliminaGiorniNonLavorativi") {
        return [eliminaGiorniMock, { loading: false }];
      }
      return [vi.fn(async () => undefined), { loading: false }];
    },
  };
});

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import GiorniNonLavorativiSection from "../GiorniNonLavorativiSection";

const ANNO_CORRENTE = dayjs().year();

let prossimoId = 1;

function giorno(
  data: string,
  descrizione = "Ferie estive",
  codiceMotivo = "FERIE",
  ricorrente = false,
): GiornoNonLavorativo {
  return {
    giornoId: prossimoId++,
    data,
    descrizione,
    codiceMotivo,
    ricorrente,
    settingsId: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

/** Fake API AG Grid: espone il listener registrato in onGridReady */
function makeFakeApi(selectedRows: Array<{ giorniIds: number[] }> = []) {
  const listeners: Record<string, () => void> = {};
  return {
    api: {
      addEventListener: (evento: string, handler: () => void) => {
        listeners[evento] = handler;
      },
      getSelectedRows: () => selectedRows,
      deselectAll: vi.fn(),
    },
    trigger: (evento: string) => listeners[evento]?.(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedDatagridProps = null;
  confirmMock.mockResolvedValue(true);
});

describe("GiorniNonLavorativiSection", () => {
  it("mostra di default l'anno corrente e i ricorrenti, escludendo gli altri anni", () => {
    render(
      <GiorniNonLavorativiSection
        giorniNonLavorativi={[
          giorno(`${ANNO_CORRENTE}-08-10`),
          giorno(`${ANNO_CORRENTE - 1}-08-10`, "Ferie vecchie"),
          giorno("2019-12-25", "Natale", "FESTIVITA_NAZIONALE", true),
        ]}
      />,
    );

    const descrizioni = capturedDatagridProps!.items.map((r) => r.descrizione);
    expect(descrizioni).toContain("Ferie estive");
    expect(descrizioni).toContain("Natale");
    expect(descrizioni).not.toContain("Ferie vecchie");
  });

  it("cambiando anno aggiorna le righe passate alla griglia", async () => {
    const user = userEvent.setup();
    render(
      <GiorniNonLavorativiSection
        giorniNonLavorativi={[giorno(`${ANNO_CORRENTE}-08-10`), giorno(`${ANNO_CORRENTE - 1}-08-10`, "Ferie vecchie")]}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Anno" }));
    await user.click(screen.getByRole("option", { name: String(ANNO_CORRENTE - 1) }));

    const descrizioni = capturedDatagridProps!.items.map((r) => r.descrizione);
    expect(descrizioni).toEqual(["Ferie vecchie"]);
  });

  it("filtra per motivo", async () => {
    const user = userEvent.setup();
    render(
      <GiorniNonLavorativiSection
        giorniNonLavorativi={[
          giorno(`${ANNO_CORRENTE}-08-10`),
          giorno(`${ANNO_CORRENTE}-11-02`, "Ristrutturazione", "CHIUSURA_STRAORDINARIA"),
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Motivo" }));
    await user.click(screen.getByRole("option", { name: "Chiusura Straordinaria" }));

    expect(capturedDatagridProps!.items.map((r) => r.descrizione)).toEqual(["Ristrutturazione"]);
  });

  it("configura la griglia ad albero con rowId stabili", () => {
    render(<GiorniNonLavorativiSection giorniNonLavorativi={[giorno(`${ANNO_CORRENTE}-08-10`)]} />);

    expect(capturedDatagridProps!.treeData).toBe(true);
    expect(capturedDatagridProps!.treeDataParentIdField).toBe("parentRowId");
    expect(capturedDatagridProps!.groupDefaultExpanded).toBe(0);
    expect(capturedDatagridProps!.rowSelection).toMatchObject({ mode: "multiRow", groupSelects: "descendants" });
    expect(capturedDatagridProps!.getRowId!({ data: { rowId: "giorno:7" } })).toBe("giorno:7");
  });

  it("collassa i giorni consecutivi in una riga intervallo", () => {
    render(
      <GiorniNonLavorativiSection
        giorniNonLavorativi={[giorno(`${ANNO_CORRENTE}-08-10`), giorno(`${ANNO_CORRENTE}-08-11`), giorno(`${ANNO_CORRENTE}-08-12`)]}
      />,
    );

    const radici = capturedDatagridProps!.items.filter((r) => r.parentRowId === null);
    expect(radici).toHaveLength(1);
    expect(radici[0]).toMatchObject({ tipoRiga: "intervallo", numeroGiorni: 3 });
  });

  it("deduplica gli id quando la selezione contiene intervallo e foglie", async () => {
    const user = userEvent.setup();
    render(
      <GiorniNonLavorativiSection
        giorniNonLavorativi={[giorno(`${ANNO_CORRENTE}-08-10`), giorno(`${ANNO_CORRENTE}-08-11`)]}
      />,
    );

    const ids = capturedDatagridProps!.items
      .filter((r) => r.tipoRiga === "giorno")
      .flatMap((r) => r.giorniIds as number[]);

    // Selezione tipica di groupSelects "descendants": la riga intervallo più le sue foglie
    const grid = makeFakeApi([{ giorniIds: ids }, { giorniIds: [ids[0]] }, { giorniIds: [ids[1]] }]);
    act(() => capturedDatagridProps!.onGridReady!(grid));
    act(() => grid.trigger("selectionChanged"));

    expect(screen.getByRole("button", { name: `Elimina (${ids.length})` })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: `Elimina (${ids.length})` }));

    expect(eliminaGiorniMock).toHaveBeenCalledWith({ variables: { giorniIds: ids } });
  });

  it("non elimina nulla se la conferma viene rifiutata", async () => {
    const user = userEvent.setup();
    confirmMock.mockResolvedValue(false);
    render(<GiorniNonLavorativiSection giorniNonLavorativi={[giorno(`${ANNO_CORRENTE}-08-10`)]} />);

    const grid = makeFakeApi([{ giorniIds: [1] }]);
    act(() => capturedDatagridProps!.onGridReady!(grid));
    act(() => grid.trigger("selectionChanged"));

    await user.click(screen.getByRole("button", { name: "Elimina (1)" }));

    expect(eliminaGiorniMock).not.toHaveBeenCalled();
  });

  it("il pulsante di eliminazione bulk è disabilitato senza selezione", () => {
    render(<GiorniNonLavorativiSection giorniNonLavorativi={[giorno(`${ANNO_CORRENTE}-08-10`)]} />);

    expect(screen.getByRole("button", { name: "Elimina (0)" })).toBeDisabled();
  });
});
