import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";

import type { DatagridCellValueChangedEvent, DatagridColDef } from "../../../common/datagrid/@types/Datagrid";

/**
 * Il gemello speculare di `VetrinaProdottiList.test.tsx`: là si verifica che la vetrina **non**
 * possa toccare il listino, qui che la cassa **non** possa toccare i campi del sito. È lo stesso
 * confine guardato dai due lati, e va guardato da entrambi: `UpsertProdottoAsync` assegna ogni
 * campo che riceve, quindi basterebbe una colonna di vetrina in questa griglia perché il primo
 * salvataggio azzerasse nome, foto e descrizione pubblica di tutti i prodotti.
 */

const propsDatagrid: Record<string, unknown>[] = [];
const propsListToolbar: Record<string, unknown>[] = [];
const submitProdotto = vi.fn();
const refetch = vi.fn();

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

vi.mock("../../../../graphql/common/useGetAll", () => ({
  default: () => ({ data: [], loading: false, error: null, refetch }),
}));

vi.mock("../../../../graphql/prodotti/useSubmitProdotto", () => ({
  default: () => ({ submitProdotto, data: undefined, error: undefined, loading: false }),
}));

vi.mock("../../../../common/toast/showToast", () => ({
  default: vi.fn(),
}));

import ProdottiList from "../ProdottiList";

function colonne(): DatagridColDef<ProdottoCassa>[] {
  return propsDatagrid[0].columnDefs as DatagridColDef<ProdottoCassa>[];
}

function colonna(field: string): DatagridColDef<ProdottoCassa> {
  const trovata = colonne().find((definizione) => definizione.field === field);
  if (!trovata) {
    throw new Error(`Colonna "${field}" assente dalla griglia`);
  }
  return trovata;
}

/** Un evento di modifica cella ridotto a ciò che la persistenza per riga usa davvero. */
function eventoModifica(riga: Partial<ProdottoCassa>): DatagridCellValueChangedEvent<ProdottoCassa> {
  return {
    data: riga,
    oldValue: "valore-precedente",
    colDef: { field: "nome" },
    node: { setData: vi.fn(), setDataValue: vi.fn() },
    api: { refreshCells: vi.fn() },
  } as unknown as DatagridCellValueChangedEvent<ProdottoCassa>;
}

async function modificaCella(riga: Partial<ProdottoCassa>) {
  const handler = propsDatagrid[0].onCellValueChanged as (evento: DatagridCellValueChangedEvent<ProdottoCassa>) => void;
  await act(async () => {
    handler(eventoModifica(riga));
  });
}

const RIGA_COMPLETA: Partial<ProdottoCassa> = {
  prodottoId: 5,
  codice: "BIRRA-P",
  nome: "Birra piccola",
  prezzo: 2.5,
  aliquotaIva: 10,
  attivo: true,
  unitaDiMisura: "pz",
};

describe("ProdottiList", () => {
  beforeEach(() => {
    propsDatagrid.length = 0;
    propsListToolbar.length = 0;
    submitProdotto.mockReset();
    submitProdotto.mockResolvedValue({ ...RIGA_COMPLETA, prodottoId: 5 });
    refetch.mockReset();
    render(<ProdottiList />);
  });

  it("non espone alcun campo di vetrina", () => {
    // 🔴 Il test che conta. Una sola di queste colonne renderebbe scrivibile da qui un campo
    //    che ha un unico scrittore legittimo, `mutateProdottoVetrina`.
    const campiVetrina = ["visibileSulSito", "nomeVetrina", "descrizioneVetrina", "categoriaVetrina", "prezzoVetrina", "immagineId", "ordinamentoVetrina", "allergeni", "novita", "consigliato", "inLavagnaDal"];
    const presenti = colonne().map((definizione) => definizione.field);
    expect(presenti.filter((campo) => campiVetrina.includes(campo as string))).toEqual([]);
  });

  it("rende modificabili i campi di cassa", () => {
    expect(colonna("codice").editable).toBe(true);
    expect(colonna("nome").editable).toBe(true);
    expect(colonna("prezzo").editable).toBe(true);
    expect(colonna("aliquotaIva").editable).toBe(true);
    expect(colonna("categoria").editable).toBe(true);
    expect(colonna("attivo").editable).toBe(true);
  });

  it("offre solo le aliquote che il server accetta", () => {
    // Un valore fuori da questo insieme viene rifiutato da `UpsertProdottoAsync`: proporlo
    // vorrebbe dire promettere un salvataggio che non può riuscire.
    const parametri = colonna("aliquotaIva").cellEditorParams as { values: number[] };
    expect(parametri.values).toEqual([0, 4, 5, 10, 22]);
  });

  it("permette di creare ma non di eliminare", () => {
    // Non esiste `eliminaProdotto`: le vendite referenziano il prodotto con vincolo
    // restrittivo. Un pulsante che fallisce sempre è peggio della sua assenza.
    expect(propsListToolbar[0].hideDeleteButton).toBe(true);
    expect(propsListToolbar[0].onNew).toBeTypeOf("function");
  });

  it("non salva una riga priva di codice o di nome", async () => {
    await modificaCella({ ...RIGA_COMPLETA, codice: "   " });
    await modificaCella({ ...RIGA_COMPLETA, nome: "" });
    expect(submitProdotto).not.toHaveBeenCalled();
  });

  it("aggiorna il prodotto esistente conservandone l'identificativo", async () => {
    await modificaCella(RIGA_COMPLETA);
    expect(submitProdotto).toHaveBeenCalledWith(expect.objectContaining({ prodottoId: 5, codice: "BIRRA-P" }));
  });

  it("crea, invece, quando la riga è ancora una bozza", async () => {
    // L'identificativo negativo serve solo a `getRowId` lato griglia: al server deve arrivare
    // `null`, che per l'upsert significa creazione. Mandare -1 sarebbe un aggiornamento a vuoto.
    await modificaCella({ ...RIGA_COMPLETA, prodottoId: -1 });
    expect(submitProdotto).toHaveBeenCalledWith(expect.objectContaining({ prodottoId: null }));
    expect(refetch).toHaveBeenCalled();
  });

  it("ripulisce il codice dagli spazi prima di salvarlo", async () => {
    await modificaCella({ ...RIGA_COMPLETA, codice: "  BIRRA-P  " });
    expect(submitProdotto).toHaveBeenCalledWith(expect.objectContaining({ codice: "BIRRA-P" }));
  });
});
