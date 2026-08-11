import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import type { DatagridColDef } from "../../../common/datagrid/@types/Datagrid";

/**
 * Il confine con la cassa non è un promemoria in code review: è la **forma** del componente.
 * Questi test guardano le props con cui la pagina costruisce la griglia — se un domani
 * qualcuno passasse un `getNewRow` o rendesse editabile `prezzo`, fallirebbero qui, prima
 * che un salvataggio riscriva il listino.
 */

const propsDatagrid: Record<string, unknown>[] = [];
const propsListToolbar: Record<string, unknown>[] = [];

vi.mock("../../../common/datagrid/Datagrid", () => ({
  default: (props: Record<string, unknown>) => {
    propsDatagrid.push(props);
    return <div data-testid="datagrid" />;
  },
}));

vi.mock("../../../common/form/toolbar/ListToolbar", () => ({
  default: (props: Record<string, unknown>) => {
    propsListToolbar.push(props);
    return <div data-testid="list-toolbar" />;
  },
}));

vi.mock("../MediaPickerDialog", () => ({
  default: () => <div data-testid="media-picker" />,
}));

vi.mock("../../../../graphql/common/useGetAll", () => ({
  default: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("@apollo/client", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
  gql: (frammenti: TemplateStringsArray | string) => frammenti,
}));

vi.mock("../../../../store/useStore", () => ({
  default: (selector: (store: Store) => unknown) =>
    selector({
      utente: { ruolo: { amministratore: true } },
    } as unknown as Store),
}));

vi.mock("../../../../common/toast/showToast", () => ({
  default: vi.fn(),
}));

import VetrinaProdottiList from "../VetrinaProdottiList";

function colonne(): DatagridColDef<ProdottoVetrina>[] {
  return propsDatagrid[0].columnDefs as DatagridColDef<ProdottoVetrina>[];
}

function colonna(field: string): DatagridColDef<ProdottoVetrina> {
  const trovata = colonne().find((definizione) => definizione.field === field);
  if (!trovata) {
    throw new Error(`Colonna "${field}" assente dalla griglia`);
  }
  return trovata;
}

describe("VetrinaProdottiList", () => {
  beforeEach(() => {
    propsDatagrid.length = 0;
    propsListToolbar.length = 0;
    render(<VetrinaProdottiList />);
  });

  it("tiene in sola lettura i campi che appartengono alla cassa", () => {
    // Modificarli da qui vorrebbe dire avere due listini, e due listini divergono sempre.
    expect(colonna("codice").editable).toBe(false);
    expect(colonna("nome").editable).toBe(false);
    expect(colonna("prezzo").editable).toBe(false);
    expect(colonna("attivo").editable).toBe(false);
    expect(colonna("pubblicatoSulSito").editable).toBe(false);
  });

  it("lascia modificabili i dieci campi vetrina", () => {
    expect(colonna("visibileSulSito").editable).toBe(true);
    expect(colonna("nomeVetrina").editable).toBe(true);
    expect(colonna("categoriaVetrina").editable).toBe(true);
    expect(colonna("prezzoVetrina").editable).toBe(true);
    expect(colonna("ordinamentoVetrina").editable).toBe(true);
    expect(colonna("novita").editable).toBe(true);
    expect(colonna("consigliato").editable).toBe(true);
    expect(colonna("allergeni").editable).toBe(true);
    expect(colonna("descrizioneVetrina").editable).toBe(true);
  });

  it("non passa alcun getNewRow alla griglia", () => {
    // Senza getNewRow, il Tab sull'ultima cella dell'ultima riga NON crea una riga nuova:
    // i prodotti nascono in cassa, non qui.
    expect(propsDatagrid[0].getNewRow).toBeUndefined();
  });

  it("nasconde i pulsanti di creazione ed eliminazione nella toolbar di pagina", () => {
    expect(propsListToolbar[0].hideNewButton).toBe(true);
    expect(propsListToolbar[0].hideDeleteButton).toBe(true);
  });

  it("nasconde anche i pulsanti standard della griglia", () => {
    expect(propsDatagrid[0].hideToolbar).toBe(true);
  });

  it("mostra il motivo della divergenza fra vetrina e cassa", () => {
    const tooltip = colonna("pubblicatoSulSito").tooltipValueGetter;
    const divergente = { data: { visibileSulSito: true, attivo: false } } as never;
    const coerente = { data: { visibileSulSito: true, attivo: true } } as never;

    expect(tooltip?.(divergente)).toContain("non verrà pubblicato");
    expect(tooltip?.(coerente)).toBe("");
  });
});
